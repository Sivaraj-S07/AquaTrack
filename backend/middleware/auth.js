const jwt = require('jsonwebtoken');
const { Users } = require('../db/db');

exports.protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'admin') {
      req.user = { _id: 'admin', id: 'admin', role: 'admin', email: decoded.email, name: decoded.name };
    } else {
      const user = Users.findById(decoded.id);
      if (!user) return res.status(401).json({ error: 'User not found' });
      if (!user.isActive) return res.status(403).json({ error: 'Account deactivated' });
      req.user = user;
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
};

exports.userOnly = (req, res, next) => {
  if (req.user?.role !== 'user') return res.status(403).json({ error: 'User access only' });
  next();
};
