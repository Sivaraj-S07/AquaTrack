import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const PALETTE = ['#06b6d4', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#ef4444'];

const SEVERITY_COLOR = {
  critical: 'var(--red)',
  warning: 'var(--amber)',
  good: 'var(--green)',
};
const SEVERITY_BG = {
  critical: 'rgba(239,68,68,0.08)',
  warning: 'rgba(245,158,11,0.08)',
  good: 'rgba(34,197,94,0.08)',
};
const SEVERITY_LABEL = {
  critical: '🔴 Critical',
  warning: '🟡 Needs Attention',
  good: '🟢 Good',
};
const RATING_COLOR = {
  Poor: 'var(--red)',
  Fair: 'var(--amber)',
  Good: 'var(--green)',
};
const IMPACT_COLOR = {
  High: 'var(--red)',
  Medium: 'var(--amber)',
  Low: 'var(--green)',
};
const COST_COLOR = {
  High: 'var(--red)',
  Medium: 'var(--amber)',
  Low: 'var(--green)',
};

const CHART_OPTS_BAR = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: {
      grid: { color: 'rgba(99,179,237,0.06)' },
      ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 12 },
    },
    y: {
      grid: { color: 'rgba(99,179,237,0.06)' },
      ticks: { color: '#64748b', font: { size: 10 } },
    },
  },
};
const DONUT_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 10 },
    },
  },
};

/* ── Small helper components ─────────────────────────────── */
function KpiCard({ label, value, icon, color, sub }) {
  return (
    <div className="kpi-card" style={{ '--kpi-color': color }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      display: 'inline-block',
      background: `${color}22`,
      color,
      border: `1px solid ${color}55`,
      borderRadius: 99,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
    }}>
      {label}
    </span>
  );
}

function OpportunityCard({ opp }) {
  const [open, setOpen] = useState(false);
  const color = SEVERITY_COLOR[opp.severity] || 'var(--cyan)';
  const bg = SEVERITY_BG[opp.severity] || 'rgba(6,182,212,0.06)';
  return (
    <div className="card" style={{ marginBottom: 16, border: `1px solid ${color}44`, background: bg }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ fontSize: 28 }}>{opp.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 3 }}>
            {opp.category}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {opp.description}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 130 }}>
          {opp.potentialSavedUnits != null && (
            <div style={{ fontWeight: 700, fontSize: 18, color }}>
              {opp.potentialSavedUnits.toLocaleString()}
            </div>
          )}
          {opp.potentialSavedPct != null && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              ~{opp.potentialSavedPct}% savings potential
            </div>
          )}
          <Badge label={SEVERITY_LABEL[opp.severity] || opp.severity} color={color} />
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 18, marginLeft: 8 }}>
          {open ? '▲' : '▼'}
        </div>
      </div>

      {open && opp.actions?.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cyan)', marginBottom: 10 }}>
            💡 Recommended Actions
          </div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {opp.actions.map((a, i) => (
              <li key={i} style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginBottom: 8,
                lineHeight: 1.6,
              }}>
                {a}
              </li>
            ))}
          </ul>

          {/* Extra metrics */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
            {opp.currentLeakagePct != null && (
              <Stat label="Current Leakage" value={`${opp.currentLeakagePct}%`} color={color} />
            )}
            {opp.targetLeakagePct != null && (
              <Stat label="Target Leakage" value={`${opp.targetLeakagePct}%`} color="var(--green)" />
            )}
            {opp.currentCV != null && (
              <Stat label="Demand Variability (CV)" value={opp.currentCV} color={color} />
            )}
            {opp.targetCV != null && (
              <Stat label="Target CV" value={opp.targetCV} color="var(--green)" />
            )}
            {opp.dailyAvgPerCapita != null && (
              <Stat label="Avg L/Capita/Day" value={`${opp.dailyAvgPerCapita} L`} color={color} />
            )}
            {opp.targetLpcd != null && (
              <Stat label="Target L/Capita/Day" value={`${opp.targetLpcd} L`} color="var(--green)" />
            )}
            {opp.correlation != null && (
              <Stat label="Temp-Demand Correlation" value={opp.correlation} color={color} />
            )}
            {opp.strength != null && (
              <Stat label="Correlation Strength" value={opp.strength} color="var(--cyan)" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-hover)',
      borderRadius: 8,
      padding: '8px 14px',
      minWidth: 140,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color }}>{value}</div>
    </div>
  );
}

function TipCard({ tip }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>{tip.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
          {tip.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
          {tip.description}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={`Impact: ${tip.impact}`} color={IMPACT_COLOR[tip.impact] || 'var(--cyan)'} />
          <Badge label={`Cost: ${tip.cost}`} color={COST_COLOR[tip.cost] || 'var(--cyan)'} />
          <Badge label={`⏱ ${tip.timeline}`} color="var(--blue)" />
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function WaterSavingsPage() {
  const navigate = useNavigate();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/predictions/savings')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load savings analysis.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-center"><div className="spinner" /><span>Analysing savings potential…</span></div>
    </div>
  );

  if (error || !data?.savings) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">💧 Water Savings Analysis</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">💧</div>
          <div className="no-data-title">No data available</div>
          <div className="no-data-sub">{error || 'Upload a CSV dataset to unlock water savings insights and efficiency recommendations.'}</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/upload')}>
            📤 Upload CSV Dataset
          </button>
        </div>
      </div>
    </div>
  );

  const { savings, originalName, uploadedAt } = data;
  const { summary, opportunities, zoneOpportunities: zoneOpp, wqiInsight, generalTips } = savings;
  const ratingColor = RATING_COLOR[summary.efficiencyRating] || 'var(--cyan)';

  /* ── Zone chart ── */
  const zoneBarData = zoneOpp?.zones?.length ? {
    labels: zoneOpp.zones.map(z => z.zone),
    datasets: [
      {
        label: 'Total Consumption',
        data: zoneOpp.zones.map(z => z.totalConsumption),
        backgroundColor: PALETTE[0] + 'cc',
        borderColor: PALETTE[0],
        borderWidth: 1,
      },
      {
        label: 'Total Leakage / Loss',
        data: zoneOpp.zones.map(z => z.totalLoss),
        backgroundColor: PALETTE[6] + 'cc',
        borderColor: PALETTE[6],
        borderWidth: 1,
      },
    ],
  } : null;

  const opportunityDonutData = opportunities.length ? {
    labels: opportunities.map(o => o.category),
    datasets: [{
      data: opportunities.map(o => o.potentialSavedUnits || 0),
      backgroundColor: PALETTE.map(c => c + 'cc'),
      borderColor: PALETTE,
      borderWidth: 1,
    }],
  } : null;

  const zoneSavingsData = zoneOpp?.opportunities?.length ? {
    labels: zoneOpp.opportunities.map(z => z.zone),
    datasets: [{
      label: 'Potential Water Saved',
      data: zoneOpp.opportunities.map(z => z.potentialSaved),
      backgroundColor: PALETTE[2] + 'cc',
      borderColor: PALETTE[2],
      borderWidth: 1,
    }],
  } : null;

  return (
    <div className="page-wrapper">
      {/* ── Header ── */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">💧 Water Savings Analysis</h1>
          <p className="page-subtitle">
            Dataset:{' '}
            <strong style={{ color: 'var(--cyan)' }}>{originalName}</strong>
            {uploadedAt && (
              <> · Last updated {new Date(uploadedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/upload')}>
          📤 Update Dataset
        </button>
      </div>

      {/* ── Summary KPIs ── */}
      <div className="kpi-grid">
        <KpiCard
          label="Total Consumption"
          value={summary.totalConsumption != null ? summary.totalConsumption.toLocaleString() : '—'}
          icon="💧"
          color="var(--cyan)"
          sub={summary.primaryMetric !== 'N/A' ? summary.primaryMetric : 'primary metric'}
        />
        <KpiCard
          label="Potential Savings"
          value={summary.totalPotentialSaved ? summary.totalPotentialSaved.toLocaleString() : '—'}
          icon="💰"
          color="var(--green)"
          sub={summary.totalPotentialPct != null ? `~${summary.totalPotentialPct}% of total consumption` : 'estimated'}
        />
        <KpiCard
          label="Avg Consumption"
          value={summary.avgConsumption != null ? summary.avgConsumption.toFixed(1) : '—'}
          icon="📊"
          color="var(--blue)"
          sub="per record (mean)"
        />
        <KpiCard
          label="System Efficiency"
          value={summary.efficiencyRating}
          icon="⚡"
          color={ratingColor}
          sub="based on all indicators"
        />
      </div>

      {/* ── Savings Opportunities ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">🎯 Savings Opportunity Breakdown</span>
          {summary.totalPotentialPct != null && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Up to <strong style={{ color: 'var(--green)' }}>{summary.totalPotentialPct}%</strong> savings achievable
            </span>
          )}
        </div>

        {opportunities.length === 0 ? (
          <div className="no-data-state" style={{ padding: '30px 0' }}>
            <div className="no-data-icon">✅</div>
            <div className="no-data-title">System performing well</div>
            <div className="no-data-sub">No major savings opportunities detected. Continue monitoring for changes.</div>
          </div>
        ) : (
          opportunities.map((opp, i) => <OpportunityCard key={i} opp={opp} />)
        )}
      </div>

      {/* ── Charts row ── */}
      {(opportunityDonutData || zoneSavingsData) && (
        <div className="grid-2" style={{ marginBottom: 24 }}>
          {opportunityDonutData && (
            <div className="card">
              <div className="card-header"><span className="card-title">💡 Savings by Category</span></div>
              <div style={{ height: 220 }}>
                <Doughnut data={opportunityDonutData} options={DONUT_OPTS} />
              </div>
            </div>
          )}
          {zoneSavingsData && (
            <div className="card">
              <div className="card-header"><span className="card-title">🗺️ Zone-Level Savings Potential</span></div>
              <div style={{ height: 220 }}>
                <Bar data={zoneSavingsData} options={CHART_OPTS_BAR} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Zone Analysis ── */}
      {zoneOpp && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">🗺️ Zone-by-Zone Analysis</span>
            {zoneOpp.benchmark && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Best-performing zone:{' '}
                <strong style={{ color: 'var(--green)' }}>{zoneOpp.benchmark.zone}</strong>{' '}
                (avg {zoneOpp.benchmark.avgConsumption} units)
              </span>
            )}
          </div>

          {zoneBarData && (
            <div style={{ height: 240, marginBottom: 20 }}>
              <Bar data={zoneBarData} options={CHART_OPTS_BAR} />
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Zone', 'Total Consumption', 'Avg / Record', 'Total Loss', 'Loss Rate', 'Savings Gap', 'Potential Saved'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zoneOpp.zones.map((z, i) => {
                  const opp = zoneOpp.opportunities.find(o => o.zone === z.zone);
                  const lossColor = z.lossRate > 20 ? 'var(--red)' : z.lossRate > 10 ? 'var(--amber)' : 'var(--green)';
                  return (
                    <tr key={z.zone} style={{
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: PALETTE[i % PALETTE.length] }}>{z.zone}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{z.totalConsumption.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{z.avgConsumption.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{z.totalLoss.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: lossColor, fontWeight: 600 }}>{z.lossRate}%</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                        {opp ? `+${opp.gap}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--green)', fontWeight: 600 }}>
                        {opp ? opp.potentialSaved.toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {zoneOpp.totalPotentialSaved > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(34,197,94,0.05)' }}>
                    <td colSpan={6} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Total Zone Savings Potential
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>
                      {zoneOpp.totalPotentialSaved.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Water Quality Insight ── */}
      {wqiInsight && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><span className="card-title">🧪 Water Quality Index</span></div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <Stat label="Mean WQI" value={wqiInsight.mean} color="var(--cyan)" />
            <Stat label="Min WQI" value={wqiInsight.min} color={wqiInsight.min < 60 ? 'var(--red)' : 'var(--amber)'} />
            <Stat label="Max WQI" value={wqiInsight.max} color="var(--green)" />
            <Stat label="Trend" value={wqiInsight.trend} color={
              wqiInsight.trend === 'Improving' ? 'var(--green)' :
              wqiInsight.trend === 'Declining' ? 'var(--red)' : 'var(--cyan)'
            } />
          </div>
          <div style={{
            background: wqiInsight.min < 60 ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.07)',
            border: `1px solid ${wqiInsight.min < 60 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            {wqiInsight.min < 60 ? '⚠️ ' : '✅ '}{wqiInsight.note}
          </div>
        </div>
      )}

      {/* ── General Tips ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">🌿 Water Efficiency Best Practices</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Actionable strategies to improve system performance
          </span>
        </div>
        <div className="grid-2" style={{ gap: 0 }}>
          {generalTips.map((tip, i) => <TipCard key={i} tip={tip} />)}
        </div>
      </div>

      {/* ── CTA row ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={() => navigate('/pipeline')}>
          🔧 View Pipeline Monitor
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/predict')}>
          🔮 View Demand Forecasts
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/analytics')}>
          📊 View Analytics
        </button>
      </div>
    </div>
  );
}
