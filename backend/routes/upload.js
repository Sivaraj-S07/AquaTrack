const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { protect, userOnly } = require('../middleware/auth');
const { processCSV }           = require('../services/csvProcessor');
const { generatePredictions }  = require('../services/predictionEngine');
const { generateSavingsAnalysis } = require('../services/savingsAnalyzer');
const { Users, Datasets }    = require('../db/db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
    cb(null, `${req.user._id}_${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) cb(null, true);
    else cb(new Error('Only CSV files are allowed'));
  },
});

// POST /api/upload
router.post('/', protect, userOnly, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const processed   = processCSV(req.file.path, req.file.originalname);
    const predictions = generatePredictions(processed);
    const savings     = generateSavingsAnalysis(processed);

    const existing = Datasets.findOne({ userId: req.user._id });
    let dataset;

    if (existing) {
      // Delete old CSV file
      try {
        const oldPath = path.join(__dirname, '../uploads', existing.filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (_) {}
      dataset = Datasets.update(existing._id, {
        filename:         processed.filename,
        originalName:     processed.originalName,
        rowCount:         processed.rowCount,
        columns:          processed.columns,
        columnTypes:      processed.columnTypes,
        stats:            processed.stats,
        data:             processed.data,
        predictions,
        savings,
        categoryInsights: processed.categoryInsights,
        uploadedAt:       new Date().toISOString(),
      });
    } else {
      dataset = Datasets.create({
        userId:           req.user._id,
        filename:         processed.filename,
        originalName:     processed.originalName,
        rowCount:         processed.rowCount,
        columns:          processed.columns,
        columnTypes:      processed.columnTypes,
        stats:            processed.stats,
        data:             processed.data,
        predictions,
        savings,
        categoryInsights: processed.categoryInsights,
      });
    }

    Users.update(req.user._id, { currentDatasetId: dataset._id });

    res.json({
      message: 'CSV uploaded and processed successfully',
      dataset: {
        id:           dataset._id,
        originalName: dataset.originalName,
        rowCount:     dataset.rowCount,
        columns:      dataset.columns,
        uploadedAt:   dataset.uploadedAt,
      },
      predictions: predictions.kpis,
    });
  } catch (err) {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// GET /api/upload/status
router.get('/status', protect, userOnly, (req, res) => {
  const dataset = Datasets.findOne({ userId: req.user._id });
  if (!dataset) return res.json({ hasDataset: false, dataset: null });
  const { originalName, rowCount, columns, uploadedAt } = dataset;
  res.json({ hasDataset: true, dataset: { originalName, rowCount, columns, uploadedAt } });
});

// DELETE /api/upload
router.delete('/', protect, userOnly, (req, res) => {
  const dataset = Datasets.findOne({ userId: req.user._id });
  if (!dataset) return res.status(404).json({ error: 'No dataset found' });
  try { fs.unlinkSync(path.join(__dirname, '../uploads', dataset.filename)); } catch (_) {}
  Datasets.delete(dataset._id);
  Users.update(req.user._id, { currentDatasetId: null });
  res.json({ message: 'Dataset removed' });
});

module.exports = router;
