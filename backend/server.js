require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./utils/logger');
const authRoutes        = require('./routes/auth');
const adminAuthRoutes   = require('./routes/adminAuth');
const uploadRoutes      = require('./routes/upload');
const predictionsRoutes = require('./routes/predictions');
const adminRoutes       = require('./routes/admin');
const profileRoutes     = require('./routes/profile');

const app = express();

// ── Security ─────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true }));

// ── Core Middleware ───────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(u => u.trim());
    if (!origin || allowed.includes(origin) || allowed.some(u => origin.endsWith('.vercel.app'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Static uploads ────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/admin/auth',  adminAuthRoutes);
app.use('/api/upload',      uploadRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/profile',    profileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', version: '2.0.0', database: 'json-file', timestamp: new Date().toISOString() });
});

// ── Error Handling ────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route ${req.originalUrl} not found` }));
app.use((err, req, res, next) => {
  logger.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 20 MB)' });
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`AquaTrack Pro backend running at http://localhost:${PORT}`);
  logger.info('Database: JSON file-based (./db/data/)');
  logger.info(`Admin: ${process.env.ADMIN_EMAIL}`);
});

module.exports = app;
