/**
 * AquaTrack – Water Savings Analyzer
 * ─────────────────────────────────────────────────────────────
 * Computes how much water was used, how much could be saved,
 * practical efficiency tips, and per-zone / per-segment breakdowns.
 */

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

// ─── Benchmark targets (industry / WHO guidance) ──────────────
const BENCHMARKS = {
  // litres per capita per day
  perCapitaIdeal: 135,
  // maximum acceptable leakage as % of total flow
  leakagePctThreshold: 10,
  // maximum coefficient of variation (std/mean) for "efficient" systems
  cvThreshold: 0.15,
  // pressure efficiency range (bar)
  pressureIdeal: { min: 2.0, max: 6.0 },
  // NRW (non-revenue water) target
  nrwTarget: 15,
};

// ─── Leakage savings ─────────────────────────────────────────
function leakageSavings(data, columns, columnTypes, stats) {
  const lossCols = columns.filter(c =>
    ['loss', 'leak', 'leakage', 'nrw', 'waste', 'unaccounted'].some(k => c.toLowerCase().includes(k)) &&
    columnTypes[c] === 'numeric'
  );
  const consumptionCols = columns.filter(c =>
    ['consumption', 'usage', 'volume', 'demand'].some(k => c.toLowerCase().includes(k)) &&
    columnTypes[c] === 'numeric'
  );

  if (!lossCols.length || !consumptionCols.length) return null;

  const lossCol = lossCols[0];
  const consumptionCol = consumptionCols[0];
  const totalLoss = stats[lossCol]?.sum || 0;
  const totalConsumption = stats[consumptionCol]?.sum || 0;
  const avgLoss = stats[lossCol]?.mean || 0;
  const avgConsumption = stats[consumptionCol]?.mean || 0;

  if (totalConsumption === 0) return null;

  const currentLeakagePct = round((totalLoss / (totalConsumption + totalLoss)) * 100);
  const targetLeakagePct = BENCHMARKS.leakagePctThreshold;
  const achievableSavingPct = Math.max(0, currentLeakagePct - targetLeakagePct);

  // Potential savings if leakage is brought to benchmark
  const potentialSavedUnits = round((achievableSavingPct / 100) * (totalConsumption + totalLoss));
  const potentialSavedPct = round((potentialSavedUnits / (totalConsumption + totalLoss)) * 100);

  return {
    category: 'Leakage Reduction',
    icon: '🔧',
    currentLeakagePct,
    targetLeakagePct,
    totalLossUnits: round(totalLoss),
    potentialSavedUnits,
    potentialSavedPct,
    severity: currentLeakagePct > 25 ? 'critical' : currentLeakagePct > 15 ? 'warning' : 'good',
    description: `Your system currently loses ${currentLeakagePct}% of total water to leakage. Reducing this to the industry benchmark of ${targetLeakagePct}% could save ${potentialSavedUnits.toLocaleString()} units.`,
    actions: [
      'Deploy acoustic leak-detection sensors on high-loss segments.',
      'Replace or reline pipes older than 20 years in critical zones.',
      'Install pressure-reducing valves (PRVs) to lower system pressure during off-peak hours — this alone can cut leakage by 10–15%.',
      'Introduce a district metered area (DMA) framework to isolate and pinpoint losses quickly.',
    ],
  };
}

// ─── Demand variability / peak shaving savings ────────────────
function variabilitySavings(stats, primaryNumericCol) {
  if (!primaryNumericCol || !stats[primaryNumericCol]) return null;
  const s = stats[primaryNumericCol];
  const cv = s.mean > 0 ? round(s.std / s.mean) : 0;
  if (cv <= 0) return null;

  // Savings potential = excess above ideal CV
  const excessCV = Math.max(0, cv - BENCHMARKS.cvThreshold);
  const potentialSavedPct = round(excessCV * 60); // empirical coefficient
  const potentialSavedUnits = round((potentialSavedPct / 100) * s.sum);

  return {
    category: 'Demand Smoothing',
    icon: '📉',
    currentCV: round(cv, 3),
    targetCV: BENCHMARKS.cvThreshold,
    potentialSavedUnits,
    potentialSavedPct,
    severity: cv > 0.4 ? 'critical' : cv > 0.2 ? 'warning' : 'good',
    description: `Demand variability (CV = ${round(cv, 3)}) is ${cv > BENCHMARKS.cvThreshold ? 'above' : 'within'} the ${BENCHMARKS.cvThreshold} benchmark. Smoothing peak demand could save an estimated ${potentialSavedPct}% of total consumption.`,
    actions: [
      'Install smart meters to give real-time feedback to consumers, shifting non-urgent usage away from peak windows.',
      'Introduce tiered pricing: higher rates during peak hours discourage discretionary demand.',
      'Build small-scale buffer storage (elevated tanks) that fill at night and supply demand peaks without stressing the network.',
      'Run targeted awareness campaigns for the highest-consumption zones identified in the zone analysis.',
    ],
  };
}

// ─── Per-capita efficiency savings ───────────────────────────
function perCapitaSavings(data, columns, columnTypes, stats, primaryNumericCol) {
  const popCols = columns.filter(c =>
    ['population', 'pop', 'served', 'residents', 'inhabitants'].some(k => c.toLowerCase().includes(k)) &&
    columnTypes[c] === 'numeric'
  );
  if (!popCols.length || !primaryNumericCol || !stats[primaryNumericCol]) return null;

  const popCol = popCols[0];
  const totalPop = stats[popCol]?.mean || 0;
  if (totalPop === 0) return null;

  const totalConsumption = stats[primaryNumericCol]?.sum || 0;
  const recordCount = data.length;
  // Unique days heuristic
  const uniqueDates = new Set(data.map(r => r['date'] || r['Date'] || r['DATE'])).size || recordCount;
  const dailyAvgPerCapita = round(totalConsumption / (totalPop * uniqueDates));

  const targetLpcd = BENCHMARKS.perCapitaIdeal;
  const actualTotal = dailyAvgPerCapita * totalPop * uniqueDates;
  const targetTotal = targetLpcd * totalPop * uniqueDates;
  const potentialSavedUnits = round(Math.max(0, actualTotal - targetTotal));
  const potentialSavedPct = actualTotal > 0 ? round((potentialSavedUnits / actualTotal) * 100) : 0;

  return {
    category: 'Per-Capita Efficiency',
    icon: '🧑‍🤝‍🧑',
    dailyAvgPerCapita,
    targetLpcd,
    totalPopulation: round(totalPop),
    potentialSavedUnits,
    potentialSavedPct,
    severity: dailyAvgPerCapita > targetLpcd * 1.5 ? 'critical' : dailyAvgPerCapita > targetLpcd * 1.2 ? 'warning' : 'good',
    description: `Average per-capita consumption is ${dailyAvgPerCapita} L/day versus the WHO-aligned target of ${targetLpcd} L/day. Aligning to target could save ${potentialSavedUnits.toLocaleString()} units over the dataset period.`,
    actions: [
      'Promote water-efficient fixtures (low-flow taps, dual-flush toilets) through subsidised replacement programmes.',
      'Introduce household water audits in the highest per-capita zones.',
      'Integrate greywater recycling for toilet flushing and irrigation — typically reduces domestic demand by 20–30%.',
      'Enforce mandatory water-efficiency standards for new residential and commercial construction.',
    ],
  };
}

// ─── Zone-level opportunity analysis ─────────────────────────
function zoneOpportunities(data, columns, columnTypes, stats) {
  const zoneCols = columns.filter(c =>
    ['zone', 'area', 'region', 'district', 'sector'].some(k => c.toLowerCase().includes(k)) &&
    columnTypes[c] === 'categorical'
  );
  const consumptionCols = columns.filter(c =>
    ['consumption', 'usage', 'volume', 'demand'].some(k => c.toLowerCase().includes(k)) &&
    columnTypes[c] === 'numeric'
  );
  const lossCols = columns.filter(c =>
    ['loss', 'leak', 'leakage'].some(k => c.toLowerCase().includes(k)) &&
    columnTypes[c] === 'numeric'
  );

  if (!zoneCols.length || !consumptionCols.length) return null;

  const zoneCol = zoneCols[0];
  const consCol = consumptionCols[0];
  const lossCol = lossCols[0] || null;

  const zoneMap = {};
  data.forEach(r => {
    const zone = r[zoneCol];
    if (!zone) return;
    if (!zoneMap[zone]) zoneMap[zone] = { consumption: [], loss: [] };
    const c = parseFloat(r[consCol]);
    if (!isNaN(c)) zoneMap[zone].consumption.push(c);
    if (lossCol) {
      const l = parseFloat(r[lossCol]);
      if (!isNaN(l)) zoneMap[zone].loss.push(l);
    }
  });

  const zones = Object.entries(zoneMap).map(([zone, vals]) => {
    const totalConsumption = round(vals.consumption.reduce((s, v) => s + v, 0));
    const avgConsumption = round(totalConsumption / (vals.consumption.length || 1));
    const totalLoss = vals.loss.length ? round(vals.loss.reduce((s, v) => s + v, 0)) : 0;
    const lossRate = (totalConsumption + totalLoss) > 0
      ? round((totalLoss / (totalConsumption + totalLoss)) * 100) : 0;

    return { zone, totalConsumption, avgConsumption, totalLoss, lossRate, recordCount: vals.consumption.length };
  }).sort((a, b) => b.totalConsumption - a.totalConsumption);

  // Identify best-performing zone as benchmark
  const benchmark = [...zones].sort((a, b) => a.avgConsumption - b.avgConsumption)[0];
  const opportunities = zones.map(z => {
    const gap = Math.max(0, z.avgConsumption - benchmark.avgConsumption);
    const potentialSaved = round(gap * z.recordCount);
    return { ...z, benchmarkAvg: benchmark.avgConsumption, gap: round(gap), potentialSaved };
  }).filter(z => z.gap > 0);

  return {
    zones,
    benchmark,
    opportunities,
    totalPotentialSaved: round(opportunities.reduce((s, z) => s + z.potentialSaved, 0)),
  };
}

// ─── Temperature / climate correlation ───────────────────────
function temperatureCorrelation(data, columns, columnTypes, stats, primaryNumericCol) {
  const tempCols = columns.filter(c =>
    ['temperature', 'temp', 'celsius', 'fahrenheit'].some(k => c.toLowerCase().includes(k)) &&
    columnTypes[c] === 'numeric'
  );
  if (!tempCols.length || !primaryNumericCol || !stats[primaryNumericCol]) return null;

  const tempCol = tempCols[0];
  const pairs = data
    .map(r => ({ temp: parseFloat(r[tempCol]), cons: parseFloat(r[primaryNumericCol]) }))
    .filter(p => !isNaN(p.temp) && !isNaN(p.cons));
  if (pairs.length < 5) return null;

  const n = pairs.length;
  const meanT = pairs.reduce((s, p) => s + p.temp, 0) / n;
  const meanC = pairs.reduce((s, p) => s + p.cons, 0) / n;
  const num = pairs.reduce((s, p) => s + (p.temp - meanT) * (p.cons - meanC), 0);
  const den = Math.sqrt(
    pairs.reduce((s, p) => s + (p.temp - meanT) ** 2, 0) *
    pairs.reduce((s, p) => s + (p.cons - meanC) ** 2, 0)
  );
  const r = den === 0 ? 0 : round(num / den, 3);
  const strength = Math.abs(r) > 0.7 ? 'Strong' : Math.abs(r) > 0.4 ? 'Moderate' : 'Weak';

  return {
    correlation: r,
    strength,
    direction: r > 0 ? 'positive' : 'negative',
    description: `There is a ${strength.toLowerCase()} ${r > 0 ? 'positive' : 'negative'} correlation (r = ${r}) between temperature and ${primaryNumericCol}. ${r > 0.4 ? 'Higher temperatures drive up water demand — target proactive conservation campaigns ahead of hot periods.' : 'Temperature does not strongly predict consumption — focus on infrastructure efficiency instead.'}`,
    actions: r > 0.4 ? [
      'Pre-position emergency reserves before forecasted heat events.',
      'Install shade structures and green roofs in high-density zones to reduce cooling-water demand.',
      'Issue conservation advisories and restrict non-essential outdoor water use during heat waves.',
    ] : [
      'Conduct detailed metering to identify non-temperature drivers of demand spikes.',
      'Explore industrial or commercial off-takes that may be driving uncorrelated peaks.',
    ],
  };
}

// ─── Master savings function ──────────────────────────────────
function generateSavingsAnalysis(dataset) {
  const { columns, columnTypes, stats, data, primaryNumericCol, rowCount } = dataset;

  const opportunities = [
    leakageSavings(data, columns, columnTypes, stats),
    variabilitySavings(stats, primaryNumericCol),
    perCapitaSavings(data, columns, columnTypes, stats, primaryNumericCol),
    temperatureCorrelation(data, columns, columnTypes, stats, primaryNumericCol),
  ].filter(Boolean);

  const zoneOpp = zoneOpportunities(data, columns, columnTypes, stats);

  // Total consumption summary
  const totalConsumption = primaryNumericCol && stats[primaryNumericCol]
    ? stats[primaryNumericCol].sum : null;
  const avgConsumption = primaryNumericCol && stats[primaryNumericCol]
    ? stats[primaryNumericCol].mean : null;

  // Aggregate savings potential
  const totalPotentialSaved = round(
    opportunities.reduce((s, o) => s + (o.potentialSavedUnits || 0), 0) +
    (zoneOpp?.totalPotentialSaved || 0)
  );
  const totalPotentialPct = totalConsumption && totalConsumption > 0
    ? round((totalPotentialSaved / totalConsumption) * 100) : null;

  // Water quality index insights (if present)
  const wqiCols = columns.filter(c =>
    ['quality', 'wqi', 'index', 'score'].some(k => c.toLowerCase().includes(k)) &&
    columnTypes[c] === 'numeric'
  );
  const wqiInsight = wqiCols.length && stats[wqiCols[0]] ? {
    column: wqiCols[0],
    mean: stats[wqiCols[0]].mean,
    min: stats[wqiCols[0]].min,
    max: stats[wqiCols[0]].max,
    trend: stats[wqiCols[0]].slope > 0.1 ? 'Improving' : stats[wqiCols[0]].slope < -0.1 ? 'Declining' : 'Stable',
    note: stats[wqiCols[0]].min < 60
      ? 'Water quality dips below acceptable levels — treatment process improvements and pipe replacements can reduce contamination-driven waste.'
      : 'Water quality is within acceptable range. Maintain current treatment standards.',
  } : null;

  // Overall efficiency rating
  let efficiencyRating = 'Good';
  const criticalCount = opportunities.filter(o => o.severity === 'critical').length;
  const warningCount = opportunities.filter(o => o.severity === 'warning').length;
  if (criticalCount >= 2 || (totalPotentialPct && totalPotentialPct > 30)) efficiencyRating = 'Poor';
  else if (criticalCount >= 1 || warningCount >= 2 || (totalPotentialPct && totalPotentialPct > 15)) efficiencyRating = 'Fair';

  // General best-practice tips always shown
  const generalTips = [
    {
      title: 'Smart Metering Network',
      icon: '📡',
      description: 'Deploy IoT-based smart meters across all distribution zones. Real-time monitoring reduces non-revenue water by 15–25% in most utility deployments.',
      impact: 'High',
      cost: 'Medium',
      timeline: '6–18 months',
    },
    {
      title: 'Pressure Management',
      icon: '⚙️',
      description: 'Optimise system pressure using PRVs and automated control valves. Each 10% pressure reduction typically cuts leakage by 8–12%.',
      impact: 'High',
      cost: 'Low',
      timeline: '1–3 months',
    },
    {
      title: 'Greywater Recycling',
      icon: '♻️',
      description: 'Implement greywater reuse systems for toilet flushing, irrigation, and industrial processes. Can offset 20–30% of potable water demand.',
      impact: 'Medium',
      cost: 'Medium',
      timeline: '3–12 months',
    },
    {
      title: 'Rainwater Harvesting',
      icon: '🌧️',
      description: 'Install rooftop collection systems linked to storage tanks for non-potable uses. Particularly effective in zones with seasonal rainfall.',
      impact: 'Medium',
      cost: 'Low',
      timeline: '1–6 months',
    },
    {
      title: 'Public Awareness Campaigns',
      icon: '📢',
      description: 'Evidence shows that targeted behavioural campaigns reduce household consumption by 5–15%. Use zone-level data to personalise messaging.',
      impact: 'Medium',
      cost: 'Low',
      timeline: '1–2 months',
    },
    {
      title: 'Pipe Rehabilitation Programme',
      icon: '🛠️',
      description: 'Proactively reline or replace ageing pipe segments identified as high-leakage in your pipeline analysis. Prioritise segments with leakage scores above 40.',
      impact: 'High',
      cost: 'High',
      timeline: '12–36 months',
    },
  ];

  return {
    summary: {
      totalConsumption,
      avgConsumption,
      totalPotentialSaved,
      totalPotentialPct,
      efficiencyRating,
      rowCount,
      primaryMetric: primaryNumericCol || 'N/A',
    },
    opportunities,
    zoneOpportunities: zoneOpp,
    wqiInsight,
    generalTips,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateSavingsAnalysis };
