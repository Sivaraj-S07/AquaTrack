/**
 * AquaTrack Pro – JSON File Database
 * Replaces MongoDB/Mongoose with a simple JSON file-based store.
 */
const fs = require('fs');
const path = require('path');

const DB_DIR  = path.join(__dirname, 'data');
const USERS_FILE    = path.join(DB_DIR, 'users.json');
const DATASETS_FILE = path.join(DB_DIR, 'datasets.json');

// Ensure data directory and files exist
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE))    fs.writeFileSync(USERS_FILE,    JSON.stringify([], null, 2));
if (!fs.existsSync(DATASETS_FILE)) fs.writeFileSync(DATASETS_FILE, JSON.stringify([], null, 2));

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Users ─────────────────────────────────────────────────────
const Users = {
  findAll() {
    return readJSON(USERS_FILE);
  },
  findById(id) {
    return readJSON(USERS_FILE).find(u => u._id === id) || null;
  },
  findOne(query) {
    const users = readJSON(USERS_FILE);
    return users.find(u => {
      return Object.entries(query).every(([k, v]) => u[k] === v);
    }) || null;
  },
  create(data) {
    const users = readJSON(USERS_FILE);
    const now   = new Date().toISOString();
    const user  = {
      _id: generateId(),
      name: data.name,
      email: data.email.toLowerCase().trim(),
      password: data.password,
      role: data.role || 'user',
      isActive: true,
      lastLogin: null,
      currentDatasetId: null,
      createdAt: now,
      updatedAt: now,
    };
    users.push(user);
    writeJSON(USERS_FILE, users);
    return user;
  },
  update(id, updates) {
    const users = readJSON(USERS_FILE);
    const idx   = users.findIndex(u => u._id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    writeJSON(USERS_FILE, users);
    return users[idx];
  },
  delete(id) {
    const users = readJSON(USERS_FILE).filter(u => u._id !== id);
    writeJSON(USERS_FILE, users);
  },
  count(query = {}) {
    return readJSON(USERS_FILE).filter(u =>
      Object.entries(query).every(([k, v]) => {
        if (v !== null && typeof v === 'object' && '$ne' in v) return u[k] !== v['$ne'];
        return u[k] === v;
      })
    ).length;
  },
};

// ── Datasets ──────────────────────────────────────────────────
const Datasets = {
  findAll() {
    return readJSON(DATASETS_FILE);
  },
  findById(id) {
    return readJSON(DATASETS_FILE).find(d => d._id === id) || null;
  },
  findOne(query) {
    return readJSON(DATASETS_FILE).find(d =>
      Object.entries(query).every(([k, v]) => d[k] === v)
    ) || null;
  },
  findByIds(ids) {
    const strIds = ids.map(String);
    return readJSON(DATASETS_FILE).filter(d => strIds.includes(d._id));
  },
  create(data) {
    const datasets = readJSON(DATASETS_FILE);
    const now      = new Date().toISOString();
    const dataset  = {
      _id: generateId(),
      userId: data.userId,
      filename: data.filename,
      originalName: data.originalName,
      rowCount: data.rowCount || 0,
      columns: data.columns || [],
      columnTypes: data.columnTypes || {},
      stats: data.stats || {},
      data: data.data || [],
      predictions: data.predictions || null,
      categoryInsights: data.categoryInsights || null,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    datasets.push(dataset);
    writeJSON(DATASETS_FILE, datasets);
    return dataset;
  },
  update(id, updates) {
    const datasets = readJSON(DATASETS_FILE);
    const idx      = datasets.findIndex(d => d._id === id);
    if (idx === -1) return null;
    datasets[idx] = { ...datasets[idx], ...updates, updatedAt: new Date().toISOString() };
    writeJSON(DATASETS_FILE, datasets);
    return datasets[idx];
  },
  delete(id) {
    const datasets = readJSON(DATASETS_FILE).filter(d => d._id !== id);
    writeJSON(DATASETS_FILE, datasets);
  },
  deleteByUserId(userId) {
    const datasets = readJSON(DATASETS_FILE).filter(d => d.userId !== userId);
    writeJSON(DATASETS_FILE, datasets);
  },
  count() {
    return readJSON(DATASETS_FILE).length;
  },
};

module.exports = { Users, Datasets };
