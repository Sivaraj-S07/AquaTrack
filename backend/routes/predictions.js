const express = require('express');
const router  = express.Router();
const { protect, userOnly } = require('../middleware/auth');
const { Datasets } = require('../db/db');

function getDataset(userId, res) {
  const ds = Datasets.findOne({ userId });
  if (!ds) {
    res.status(404).json({ error: 'No dataset uploaded yet. Please upload a CSV file first.' });
    return null;
  }
  return ds;
}

router.get('/', protect, userOnly, (req, res) => {
  const ds = getDataset(req.user._id, res);
  if (!ds) return;
  res.json({ predictions: ds.predictions, uploadedAt: ds.uploadedAt, originalName: ds.originalName });
});

router.get('/forecast', protect, userOnly, (req, res) => {
  const ds = getDataset(req.user._id, res);
  if (!ds) return;
  res.json({ forecast: ds.predictions?.forecast || null, trendChart: ds.predictions?.trendChart || null, kpis: ds.predictions?.kpis || null });
});

router.get('/anomalies', protect, userOnly, (req, res) => {
  const ds = getDataset(req.user._id, res);
  if (!ds) return;
  res.json({ anomalies: ds.predictions?.anomalies || [], kpis: ds.predictions?.kpis });
});

router.get('/zones', protect, userOnly, (req, res) => {
  const ds = getDataset(req.user._id, res);
  if (!ds) return;
  res.json({ zoneDistribution: ds.predictions?.zoneDistribution || [], categoryCharts: ds.predictions?.categoryCharts || [] });
});

router.get('/leakage', protect, userOnly, (req, res) => {
  const ds = getDataset(req.user._id, res);
  if (!ds) return;
  res.json({ leakageRisk: ds.predictions?.leakageRisk || null });
});

router.get('/columns', protect, userOnly, (req, res) => {
  const ds = getDataset(req.user._id, res);
  if (!ds) return;
  res.json({ columnSummary: ds.predictions?.columnSummary || [] });
});

router.get('/pipeline', protect, userOnly, (req, res) => {
  const ds = getDataset(req.user._id, res);
  if (!ds) return;
  res.json({
    pipeline:        ds.predictions?.pipelineAnalysis || null,
    climateInsights: ds.predictions?.climateInsights  || null,
    seasonality:     ds.predictions?.seasonality      || null,
    kpis:            ds.predictions?.kpis             || null,
  });
});

router.get('/savings', protect, userOnly, (req, res) => {
  const ds = getDataset(req.user._id, res);
  if (!ds) return;
  // If savings weren't computed at upload time (legacy dataset), recompute on-the-fly
  if (!ds.savings) {
    const { generateSavingsAnalysis } = require('../services/savingsAnalyzer');
    const { processCSV } = require('../services/csvProcessor');
    const path = require('path');
    const fs   = require('fs');
    try {
      const filePath = path.join(__dirname, '../uploads', ds.filename);
      if (fs.existsSync(filePath)) {
        const processed = processCSV(filePath, ds.originalName);
        ds.savings = generateSavingsAnalysis(processed);
      } else {
        // Recompute from stored data
        const fakeDataset = {
          columns: ds.columns,
          columnTypes: ds.columnTypes,
          stats: ds.stats,
          data: ds.data || [],
          primaryNumericCol: ds.columns.find(c => ['consumption','usage','volume','demand'].some(k => c.toLowerCase().includes(k))) || ds.columns.find(c => ds.columnTypes[c] === 'numeric'),
          rowCount: ds.rowCount,
        };
        ds.savings = generateSavingsAnalysis(fakeDataset);
      }
    } catch (e) {
      return res.status(500).json({ error: 'Could not compute savings analysis: ' + e.message });
    }
  }
  res.json({ savings: ds.savings, originalName: ds.originalName, uploadedAt: ds.uploadedAt });
});

router.get('/data', protect, userOnly, (req, res) => {
  const ds    = getDataset(req.user._id, res);
  if (!ds) return;
  const limit = parseInt(req.query.limit) || 200;
  const page  = parseInt(req.query.page)  || 0;
  const slice = (ds.data || []).slice(page * limit, (page + 1) * limit);
  res.json({ data: slice, total: ds.rowCount, columns: ds.columns });
});

module.exports = router;
