/**
 * AquaTrack Pro v3 – Prediction Engine
 * ──────────────────────────────────────────────────────────────
 * Generates demand forecasts, anomaly detection, efficiency
 * scoring, zone distribution, AND pipeline/leakage analytics.
 */

const { linearSlope } = require('./csvProcessor');

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

function movingAverage(arr, window = 7) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    return round(slice.reduce((s, v) => s + v, 0) / slice.length);
  });
}

function linearForecast(values, steps = 14) {
  const n = values.length;
  if (n < 2) return Array(steps).fill(values[0] || 0);
  const slope = linearSlope(values);
  const intercept = values.reduce((s, v) => s + v, 0) / n - slope * ((n - 1) / 2);
  return Array.from({ length: steps }, (_, i) =>
    round(Math.max(0, intercept + slope * (n + i)))
  );
}

function expSmoothForecast(values, steps = 14, alpha = 0.3) {
  if (values.length === 0) return Array(steps).fill(0);
  let smoothed = values[0];
  for (let i = 1; i < values.length; i++) {
    smoothed = alpha * values[i] + (1 - alpha) * smoothed;
  }
  const slope = linearSlope(values);
  return Array.from({ length: steps }, (_, i) =>
    round(Math.max(0, smoothed + slope * (i + 1)))
  );
}

function detectAnomalies(values, stats) {
  if (!stats) return [];
  const upper = stats.mean + 2 * stats.std;
  const lower = Math.max(0, stats.mean - 2 * stats.std);
  return values
    .map((v, i) => {
      const num = parseFloat(v);
      if (isNaN(num)) return null;
      if (num > upper) return { index: i, value: num, severity: 'high', threshold: upper };
      if (num < lower && lower > 0) return { index: i, value: num, severity: 'low', threshold: lower };
      return null;
    })
    .filter(Boolean);
}

function efficiencyScore(stats) {
  if (!stats || stats.mean === 0) return 50;
  const cv = stats.std / stats.mean;
  return round(Math.max(0, Math.min(100, 100 - cv * 100)));
}

function riskLevel(slope, anomalyCount, total) {
  const rate = total > 0 ? anomalyCount / total : 0;
  if (slope > 5 || rate > 0.1) return 'High';
  if (slope > 1 || rate > 0.05) return 'Medium';
  return 'Low';
}

function forecastLabels(lastDate, steps) {
  const d = lastDate ? new Date(lastDate) : null;
  if (!d || isNaN(d.getTime())) {
    return Array.from({ length: steps }, (_, i) => `Period +${i + 1}`);
  }
  return Array.from({ length: steps }, (_, i) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + i + 1);
    return nd.toISOString().split('T')[0];
  });
}

function detectSeasonality(values) {
  if (values.length < 14) return null;
  const weekly = [];
  for (let i = 7; i < values.length; i++) {
    weekly.push(Math.abs(values[i] - values[i - 7]));
  }
  const avgChange = weekly.reduce((s, v) => s + v, 0) / weekly.length;
  const overallMean = values.reduce((s, v) => s + v, 0) / values.length;
  const seasonalStrength = overallMean > 0 ? round((avgChange / overallMean) * 100) : 0;
  return {
    detected: seasonalStrength > 5,
    strength: seasonalStrength,
    label: seasonalStrength > 20 ? 'Strong' : seasonalStrength > 10 ? 'Moderate' : 'Weak',
  };
}

function analyzePipeline(data, columns, columnTypes, stats) {
  const numCols = columns.filter(c => columnTypes[c] === 'numeric');
  const catCols = columns.filter(c => columnTypes[c] === 'categorical');

  const pressureCols = numCols.filter(c =>
    ['pressure', 'psi', 'bar', 'inlet', 'outlet'].some(k => c.toLowerCase().includes(k))
  );
  const flowCols = numCols.filter(c =>
    ['flow', 'flowrate', 'flow_rate', 'discharge', 'velocity'].some(k => c.toLowerCase().includes(k))
  );
  const pipeCols = catCols.filter(c =>
    ['pipe', 'segment', 'pipeline', 'line', 'section', 'network', 'node'].some(k => c.toLowerCase().includes(k))
  );
  const lossCols = numCols.filter(c =>
    ['loss', 'leak', 'leakage', 'nrw', 'waste', 'unaccounted'].some(k => c.toLowerCase().includes(k))
  );

  const segments = [];

  if (pipeCols.length > 0 && (pressureCols.length > 0 || flowCols.length > 0)) {
    const pipeCol = pipeCols[0];
    const pressureCol = pressureCols[0] || null;
    const flowCol = flowCols[0] || null;
    const lossCol = lossCols[0] || null;

    const pipeMap = {};
    data.forEach(r => {
      const seg = r[pipeCol];
      if (!seg) return;
      if (!pipeMap[seg]) pipeMap[seg] = { pressures: [], flows: [], losses: [] };
      if (pressureCol) { const p = parseFloat(r[pressureCol]); if (!isNaN(p)) pipeMap[seg].pressures.push(p); }
      if (flowCol) { const f = parseFloat(r[flowCol]); if (!isNaN(f)) pipeMap[seg].flows.push(f); }
      if (lossCol) { const l = parseFloat(r[lossCol]); if (!isNaN(l)) pipeMap[seg].losses.push(l); }
    });

    Object.entries(pipeMap).slice(0, 15).forEach(([seg, vals]) => {
      const avgPressure = vals.pressures.length
        ? round(vals.pressures.reduce((s, v) => s + v, 0) / vals.pressures.length) : null;
      const avgFlow = vals.flows.length
        ? round(vals.flows.reduce((s, v) => s + v, 0) / vals.flows.length) : null;
      const avgLoss = vals.losses.length
        ? round(vals.losses.reduce((s, v) => s + v, 0) / vals.losses.length) : null;

      let pressureVariance = null;
      if (vals.pressures.length > 1 && avgPressure) {
        pressureVariance = round(
          vals.pressures.reduce((s, v) => s + (v - avgPressure) ** 2, 0) / vals.pressures.length
        );
      }

      const leakageScore = pressureVariance !== null
        ? round(Math.min(100, (pressureVariance / (avgPressure || 1)) * 100))
        : (avgLoss !== null ? round(Math.min(100, avgLoss)) : 0);

      const status = leakageScore > 40 ? 'Critical' : leakageScore > 20 ? 'Warning' : 'Normal';

      segments.push({
        segment: seg, avgPressure, avgFlow, avgLoss,
        leakageScore, status,
        recordCount: Math.max(vals.pressures.length, vals.flows.length, vals.losses.length, 1),
      });
    });
  }

  let avgSystemPressure = null, avgSystemFlow = null, totalLoss = null;
  if (pressureCols.length > 0) avgSystemPressure = stats[pressureCols[0]]?.mean || null;
  if (flowCols.length > 0) avgSystemFlow = stats[flowCols[0]]?.mean || null;
  if (lossCols.length > 0) totalLoss = stats[lossCols[0]]?.sum || null;

  const nrwPercent = totalLoss && avgSystemFlow
    ? round((totalLoss / (avgSystemFlow * data.length)) * 100) : null;

  return {
    segments: segments.sort((a, b) => b.leakageScore - a.leakageScore),
    hasPipelineData: segments.length > 0,
    kpis: {
      avgSystemPressure, avgSystemFlow, totalLoss, nrwPercent,
      criticalSegments: segments.filter(s => s.status === 'Critical').length,
      warningSegments: segments.filter(s => s.status === 'Warning').length,
      normalSegments: segments.filter(s => s.status === 'Normal').length,
    },
    pressureCol: pressureCols[0] || null,
    flowCol: flowCols[0] || null,
    pressureTrend: pressureCols[0] && stats[pressureCols[0]]
      ? (stats[pressureCols[0]].slope > 0.5 ? 'Increasing' : stats[pressureCols[0]].slope < -0.5 ? 'Decreasing' : 'Stable')
      : null,
  };
}

function climateSustainabilityInsights(forecast, primaryStats, rowCount) {
  if (!primaryStats) return null;
  const trend = primaryStats.slope;
  const trendPct = primaryStats.mean > 0 ? round((Math.abs(trend) / primaryStats.mean) * 100) : 0;
  const insights = [];

  if (trend > 1) {
    insights.push({ type: 'warning', icon: '🌡️', title: 'Rising Consumption Detected',
      message: `Water demand is increasing at ${trendPct}% per period. This may reflect population growth or climate-driven usage increases. Consider demand-management interventions.` });
  } else if (trend < -1) {
    insights.push({ type: 'success', icon: '✅', title: 'Demand Reduction Achieved',
      message: `Water consumption is declining at ${trendPct}% per period — indicating successful conservation measures or efficiency improvements.` });
  } else {
    insights.push({ type: 'info', icon: '📊', title: 'Stable Consumption Pattern',
      message: 'Water usage is relatively stable. Continue monitoring for climate-driven seasonal shifts.' });
  }

  if (primaryStats.std / primaryStats.mean > 0.3) {
    insights.push({ type: 'warning', icon: '⚡', title: 'High Demand Variability',
      message: 'Significant fluctuations in water usage detected. Variability may signal infrastructure inefficiencies or unmapped demand peaks.' });
  }

  if (forecast) {
    const forecastAvg = forecast.summary?.next14DayAvg;
    if (forecastAvg && forecastAvg > primaryStats.mean * 1.1) {
      insights.push({ type: 'alert', icon: '⚠️', title: 'Demand Surge Forecasted',
        message: `Predicted demand (${forecastAvg.toFixed(1)}) exceeds historical average by >10%. Ensure sufficient reservoir and infrastructure capacity.` });
    }
  }

  insights.push({ type: 'info', icon: '💡', title: 'Sustainability Recommendation',
    message: 'Consider investing in smart metering, leak detection networks, and greywater recycling to reduce overall system losses by 15–30%.' });

  return insights;
}

function generatePredictions(dataset) {
  const { columns, columnTypes, stats, data, categoryInsights, dateCol, primaryNumericCol, timeSeries, rowCount } = dataset;
  const numericCols = columns.filter(c => columnTypes[c] === 'numeric');
  const categoricalCols = columns.filter(c => columnTypes[c] === 'categorical');

  let forecast = null, trendChart = null, anomalies = [], primaryStats = null, seasonality = null;

  if (primaryNumericCol && stats[primaryNumericCol]) {
    primaryStats = stats[primaryNumericCol];
    const values = data.map(r => parseFloat(r[primaryNumericCol])).filter(v => !isNaN(v));
    const linearNext = linearForecast(values, 14);
    const expNext = expSmoothForecast(values, 14);
    const nextValues = linearNext.map((v, i) => round(v * 0.6 + expNext[i] * 0.4));
    const lastDate = timeSeries.length ? timeSeries[timeSeries.length - 1]?.date : null;
    const labels = forecastLabels(lastDate, 14);

    anomalies = detectAnomalies(data.map(r => r[primaryNumericCol]), primaryStats);
    seasonality = detectSeasonality(values);

    forecast = {
      column: primaryNumericCol,
      nextPeriodValues: nextValues,
      forecastLabels: labels,
      method: 'Blended Linear + Exponential Smoothing',
      summary: {
        next7DayAvg: round(nextValues.slice(0, 7).reduce((s, v) => s + v, 0) / 7),
        next14DayAvg: round(nextValues.reduce((s, v) => s + v, 0) / 14),
        trend: primaryStats.slope > 0.5 ? 'Increasing' : primaryStats.slope < -0.5 ? 'Decreasing' : 'Stable',
        trendValue: primaryStats.slope,
        confidence: values.length >= 30 ? 'High' : values.length >= 14 ? 'Medium' : 'Low',
      },
    };

    const histSlice = timeSeries.slice(-60);
    trendChart = {
      labels: histSlice.map(r => r.date),
      actual: histSlice.map(r => r.value),
      movingAvg: movingAverage(histSlice.map(r => r.value), 7),
    };
  }

  const columnSummary = numericCols.map(col => {
    const s = stats[col];
    if (!s) return null;
    const anom = detectAnomalies(data.map(r => r[col]), s);
    return {
      column: col,
      mean: s.mean, median: s.median, min: s.min, max: s.max, std: s.std, sum: s.sum,
      trend: s.slope > 0.5 ? 'Increasing' : s.slope < -0.5 ? 'Decreasing' : 'Stable',
      trendValue: s.slope,
      efficiencyScore: efficiencyScore(s),
      riskLevel: riskLevel(s.slope, anom.length, s.count),
      anomalyCount: anom.length,
    };
  }).filter(Boolean);

  const zoneCols = categoricalCols.filter(c =>
    ['zone', 'area', 'region', 'district', 'sector', 'location', 'block', 'ward', 'city'].some(k =>
      c.toLowerCase().includes(k))
  );
  let zoneDistribution = null;
  if (zoneCols.length > 0 && primaryNumericCol) {
    const zoneCol = zoneCols[0];
    const zoneMap = {};
    data.forEach(r => {
      const zone = r[zoneCol];
      const val = parseFloat(r[primaryNumericCol]);
      if (zone && !isNaN(val)) {
        if (!zoneMap[zone]) zoneMap[zone] = [];
        zoneMap[zone].push(val);
      }
    });
    zoneDistribution = Object.entries(zoneMap)
      .map(([zone, vals]) => {
        const total = round(vals.reduce((s, v) => s + v, 0));
        const avg = round(total / vals.length);
        const zStat = { mean: avg, std: round(Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length)) };
        return { zone, total, avg, count: vals.length, anomalies: detectAnomalies(vals, zStat).length, efficiency: efficiencyScore(zStat) };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }

  const categoryCharts = Object.entries(categoryInsights || {})
    .slice(0, 5)
    .map(([col, dist]) => ({ column: col, labels: Object.keys(dist), values: Object.values(dist) }));

  const pressureCols = numericCols.filter(c =>
    ['pressure', 'psi', 'bar', 'flow', 'leak'].some(k => c.toLowerCase().includes(k))
  );
  let leakageRisk = null;
  if (pressureCols.length > 0) {
    const pc = pressureCols[0];
    const ps = stats[pc];
    if (ps) {
      const anomCount = detectAnomalies(data.map(r => r[pc]), ps).length;
      leakageRisk = {
        column: pc, anomalyCount: anomCount,
        riskScore: round(Math.min(100, (anomCount / rowCount) * 1000)),
        severity: anomCount > rowCount * 0.1 ? 'Critical' : anomCount > rowCount * 0.05 ? 'Warning' : 'Normal',
      };
    }
  }

  const pipelineAnalysis = analyzePipeline(data, columns, columnTypes, stats);
  const climateInsights = climateSustainabilityInsights(forecast, primaryStats, rowCount);

  const kpis = {
    totalRows: rowCount,
    numericColumns: numericCols.length,
    categoricalColumns: categoricalCols.length,
    totalAnomalies: anomalies.length,
    primaryMetric: primaryNumericCol || 'N/A',
    primaryMean: primaryStats?.mean || null,
    primaryMax: primaryStats?.max || null,
    primaryMin: primaryStats?.min || null,
    primarySum: primaryStats?.sum || null,
    overallTrend: forecast?.summary?.trend || 'Unknown',
    efficiencyScore: primaryStats ? efficiencyScore(primaryStats) : null,
    leakageRisk: leakageRisk?.severity || (pipelineAnalysis.kpis.criticalSegments > 0 ? 'Critical' : 'Normal'),
    forecastConfidence: forecast?.summary?.confidence || 'Low',
    seasonalityDetected: seasonality?.detected || false,
    nrwPercent: pipelineAnalysis.kpis.nrwPercent,
    criticalPipeSegments: pipelineAnalysis.kpis.criticalSegments,
  };

  return { kpis, forecast, trendChart, seasonality, anomalies: anomalies.slice(0, 100), columnSummary, zoneDistribution, categoryCharts, leakageRisk, pipelineAnalysis, climateInsights, generatedAt: new Date().toISOString() };
}

module.exports = { generatePredictions };
