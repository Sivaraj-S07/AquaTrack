const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

/**
 * Admin credentials are stored in .env only.
 * No database lookup – pure token-based stateless auth.
 */
const signAdminToken = () =>
  jwt.sign(
    { role: 'admin', email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

// POST /api/admin/auth/login  – admin only, no signup
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;

  // Compare against .env values
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = signAdminToken();
  res.json({
    token,
    user: {
      id: 'admin',
      name: process.env.ADMIN_NAME || 'Admin',
      email: adminEmail,
      role: 'admin',
    },
  });
});

module.exports = router;
