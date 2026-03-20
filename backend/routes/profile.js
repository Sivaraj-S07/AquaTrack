const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { body, validationResult } = require('express-validator');
const { Users }  = require('../db/db');
const { protect } = require('../middleware/auth');

// ── Avatar Upload Setup ───────────────────────────────────────
const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.user._id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed (jpg, png, webp, gif)'));
  },
});

// ── GET /api/profile ─────────────────────────────────────────
router.get('/', protect, (req, res) => {
  const user = Users.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: {
      id:        user._id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      avatarUrl: user.avatarUrl || null,
      createdAt: user.createdAt,
    },
  });
});

// ── PATCH /api/profile/name ───────────────────────────────────
router.patch('/name',
  protect,
  [body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 60 }).withMessage('Name too long')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name } = req.body;
      const updated = Users.update(req.user._id, { name });
      if (!updated) return res.status(404).json({ error: 'User not found' });
      res.json({ message: 'Name updated successfully', name: updated.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/profile/email ──────────────────────────────────
router.patch('/email',
  protect,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid Gmail address required'),
    body('currentPassword').notEmpty().withMessage('Current password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, currentPassword } = req.body;

      // Validate Gmail
      if (!email.endsWith('@gmail.com')) {
        return res.status(400).json({ error: 'Only Gmail addresses are accepted' });
      }

      const user = Users.findById(req.user._id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Verify current password
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

      // Check if email taken
      const existing = Users.findOne({ email });
      if (existing && existing._id !== user._id) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      const updated = Users.update(user._id, { email });
      res.json({ message: 'Email updated successfully', email: updated.email });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/profile/password ───────────────────────────────
router.patch('/password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must include an uppercase letter')
      .matches(/[0-9]/).withMessage('Must include a number'),
    body('confirmPassword').notEmpty().withMessage('Please confirm your new password'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }

      const user = Users.findById(req.user._id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must differ from current password' });
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      Users.update(user._id, { password: hashed });
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/profile/avatar ──────────────────────────────────
router.post('/avatar', protect, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    try {
      const user = Users.findById(req.user._id);

      // Delete old avatar if it exists
      if (user.avatarUrl) {
        const oldFile = path.join(__dirname, '..', user.avatarUrl.replace('/uploads/', 'uploads/'));
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      Users.update(user._id, { avatarUrl });
      res.json({ message: 'Profile picture updated', avatarUrl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// ── DELETE /api/profile/avatar ────────────────────────────────
router.delete('/avatar', protect, (req, res) => {
  try {
    const user = Users.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.avatarUrl) {
      const filePath = path.join(__dirname, '..', user.avatarUrl.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    Users.update(user._id, { avatarUrl: null });
    res.json({ message: 'Profile picture removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
