const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { Users, Datasets } = require('../db/db');

router.use(protect, adminOnly);

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users    = Users.findAll().filter(u => u.role === 'user');
  const ids      = users.map(u => u._id);
  const datasets = Datasets.findAll().filter(d => ids.includes(d.userId));
  const dsMap    = {};
  datasets.forEach(d => { dsMap[d.userId] = { _id: d._id, originalName: d.originalName, rowCount: d.rowCount, uploadedAt: d.uploadedAt }; });
  const result = users
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(u => {
      const { password, ...safe } = u;
      return { ...safe, dataset: dsMap[u._id] || null };
    });
  res.json({ users: result, total: result.length });
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const allUsers  = Users.findAll().filter(u => u.role === 'user');
  const totalUsers     = allUsers.length;
  const usersWithData  = allUsers.filter(u => u.currentDatasetId).length;
  const totalDatasets  = Datasets.count();
  const recentUsers    = allUsers
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(({ _id, name, email, createdAt, currentDatasetId }) => ({ _id, name, email, createdAt, currentDatasetId }));
  res.json({ totalUsers, usersWithData, totalDatasets, recentUsers });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const user = Users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  Datasets.deleteByUserId(user._id);
  Users.delete(user._id);
  res.json({ message: 'User and data deleted' });
});

// PATCH /api/admin/users/:id/toggle
router.patch('/users/:id/toggle', (req, res) => {
  const user = Users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const updated = Users.update(user._id, { isActive: !user.isActive });
  res.json({ message: `User ${updated.isActive ? 'activated' : 'deactivated'}`, isActive: updated.isActive });
});

module.exports = router;
