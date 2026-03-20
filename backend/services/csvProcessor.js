const { parse } = require('csv-parse/sync');
const fs = require('fs');

/**
 * Parse a CSV file and return rows + column metadata.
 */
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: false,
  });
  return records;
}

/**
 * Detect column type: 'date' | 'numeric' | 'categorical'
 */
function detectType(values) {
  const sample = values.filter(Boolean).slice(0, 50);
  // Date check
  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{4}/;
  const dateCount = sample.filter(v => datePattern.test(v) && !isNaN(Date.parse(v))).length;
  if (dateCount / sample.length > 0.7) return 'date';

  // Numeric check
  const numCount = sample.filter(v => v !== '' && !isNaN(parseFloat(v))).length;
  if (numCount / sample.length > 0.7) return 'numeric';

  return 'categorical';
}

/**
 * Compute descriptive stats for a numeric column.
 */
function computeStats(values) {
  const nums = values
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));

  if (nums.length === 0) return null;

  nums.sort((a, b) => a - b);
  const n = nums.length;
  const mean = nums.reduce((s, v) => s + v, 0) / n;
  const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const median = n % 2 === 0 ? (nums[n / 2 - 1] + nums[n / 2]) / 2 : nums[Math.floor(n / 2)];

  // Simple linear trend (slope over index)
  const slope = linearSlope(nums);

  return {
    count: n,
    mean: round(mean),
    median: round(median),
    std: round(std),
    min: round(nums[0]),
    max: round(nums[n - 1]),
    sum: round(nums.reduce((s, v) => s + v, 0)),
    slope: round(slope), // positive = upward trend
    anomalyThreshold: round(mean + 2 * std),
  };
}

/**
 * Least-squares slope over an array of numbers.
 */
function linearSlope(arr) {
  const n = arr.length;
  if (n < 2) return 0;
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = arr.reduce((s, v) => s + v, 0);
  const sumXY = arr.reduce((s, v, i) => s + i * v, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
}

/**
 * Category distribution (value → count map).
 */
function categoryDistribution(values) {
  const dist = {};
  values.forEach(v => {
    if (v === '' || v == null) return;
    dist[v] = (dist[v] || 0) + 1;
  });
  // Sort by count desc, keep top 20
  return Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});
}

/**
 * Master processor: parse CSV, detect types, compute stats.
 * Returns enriched dataset object.
 */
function processCSV(filePath, originalName) {
  const rows = parseCSV(filePath);
  if (!rows.length) throw new Error('CSV file is empty');

  const columns = Object.keys(rows[0]);
  const columnTypes = {};
  const stats = {};
  const categoryInsights = {};

  columns.forEach(col => {
    const vals = rows.map(r => r[col]);
    const type = detectType(vals);
    columnTypes[col] = type;

    if (type === 'numeric') {
      stats[col] = computeStats(vals);
    } else if (type === 'categorical') {
      categoryInsights[col] = categoryDistribution(vals);
    }
  });

  // Detect primary date column
  const dateCol = columns.find(c => columnTypes[c] === 'date');
  // Detect primary numeric column (prefer consumption/usage/volume/flow)
  const keywords = ['consumption', 'usage', 'volume', 'flow', 'demand', 'liter', 'litre', 'gallon', 'quantity'];
  const primaryNumericCol =
    columns.find(c => columnTypes[c] === 'numeric' && keywords.some(k => c.toLowerCase().includes(k))) ||
    columns.find(c => columnTypes[c] === 'numeric');

  // Build time-series data (date + primary numeric)
  let timeSeries = [];
  if (dateCol && primaryNumericCol) {
    timeSeries = rows
      .map(r => ({
        date: r[dateCol],
        value: parseFloat(r[primaryNumericCol]) || 0,
      }))
      .filter(r => !isNaN(r.value))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // Capped data for storage (10k rows max)
  const data = rows.slice(0, 10000);

  return {
    filename: filePath.split('/').pop(),
    originalName,
    rowCount: rows.length,
    columns,
    columnTypes,
    stats,
    data,
    categoryInsights,
    dateCol,
    primaryNumericCol,
    timeSeries,
  };
}

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

module.exports = { processCSV, computeStats, linearSlope };
