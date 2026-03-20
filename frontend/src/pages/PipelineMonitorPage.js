import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 12 } },
    y: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } },
  },
};
const STATUS_COLOR = { Critical: 'var(--red)', Warning: 'var(--amber)', Normal: 'var(--green)' };
const BADGE_CLASS  = { Critical: 'badge-red', Warning: 'badge-amber', Normal: 'badge-green' };

function LeakBar({ score, status }) {
  const color = STATUS_COLOR[status] || 'var(--cyan)';
  return <div className="leakage-bar"><div className="leakage-fill" style={{ width: `${Math.min(100, score)}%`, background: color }} /></div>;
}

export default function PipelineMonitorPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.get('/predictions/pipeline').then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  const localStatus = (s) => s === 'Critical' ? t.pipeline.critical : s === 'Warning' ? t.pipeline.warning : t.pipeline.normal;

  if (loading) return <div className="page-wrapper"><div className="loading-center"><div className="spinner" /><span>{t.pipeline.loading}</span></div></div>;
  if (!data) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">{t.pipeline.title}</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">🔧</div>
          <div className="no-data-title">{t.pipeline.noData}</div>
          <div className="no-data-sub">{t.pipeline.noDataSub}</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/upload')}>{t.pipeline.uploadCsvBtn}</button>
        </div>
      </div>
    </div>
  );

  const { pipeline, climateInsights, seasonality } = data;
  const pk = pipeline?.kpis || {};
  const segments = pipeline?.segments || [];

  const segChartData = segments.length ? {
    labels: segments.map(s => s.segment),
    datasets: [{ label: t.pipeline.leakageScore, data: segments.map(s => s.leakageScore),
      backgroundColor: segments.map(s => s.status === 'Critical' ? 'rgba(239,68,68,0.7)' : s.status === 'Warning' ? 'rgba(245,158,11,0.7)' : 'rgba(34,197,94,0.5)'),
      borderColor: segments.map(s => STATUS_COLOR[s.status] || 'var(--cyan)'), borderWidth: 1, borderRadius: 4 }],
  } : null;

  const doughnutData = {
    labels: [t.pipeline.critical, t.pipeline.warning, t.pipeline.normal],
    datasets: [{ data: [pk.criticalSegments || 0, pk.warningSegments || 0, pk.normalSegments || 0],
      backgroundColor: ['rgba(239,68,68,0.7)','rgba(245,158,11,0.7)','rgba(34,197,94,0.5)'],
      borderColor: ['#ef4444','#f59e0b','#22c55e'], borderWidth: 1 }],
  };
  const totalSegs = (pk.criticalSegments||0) + (pk.warningSegments||0) + (pk.normalSegments||0);

  const TABS = [{ id: 'overview', label: t.pipeline.networkOverview }, { id: 'segments', label: t.pipeline.segmentDetails }, { id: 'climate', label: t.pipeline.climateInsights }];

  return (
    <div className="page-wrapper">
      <div className="page-header flex-between">
        <div><h1 className="page-title">{t.pipeline.title}</h1><p className="page-subtitle">{t.pipeline.subtitle}</p></div>
        {seasonality && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
            {t.pipeline.seasonality} <span style={{ color: seasonality.detected ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>
              {seasonality.detected ? `${seasonality.label} (${seasonality.strength}%)` : t.pipeline.notDetectedLabel}
            </span>
          </div>
        )}
      </div>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--kpi-color': 'var(--cyan)' }}><div className="kpi-icon">💧</div><div className="kpi-label">{t.pipeline.avgSystemPressure}</div><div className="kpi-value" style={{ color: 'var(--cyan)' }}>{pk.avgSystemPressure != null ? `${pk.avgSystemPressure.toFixed(1)}` : '—'}</div><div className="kpi-sub">{t.pipeline.psiBar}</div></div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--blue)' }}><div className="kpi-icon">🌊</div><div className="kpi-label">{t.pipeline.avgSystemFlow}</div><div className="kpi-value" style={{ color: 'var(--blue)' }}>{pk.avgSystemFlow != null ? pk.avgSystemFlow.toFixed(1) : '—'}</div><div className="kpi-sub">{t.pipeline.flowUnit}</div></div>
        <div className="kpi-card" style={{ '--kpi-color': pk.criticalSegments > 0 ? 'var(--red)' : 'var(--green)' }}><div className="kpi-icon">🚨</div><div className="kpi-label">{t.pipeline.criticalSegments}</div><div className="kpi-value" style={{ color: pk.criticalSegments > 0 ? 'var(--red)' : 'var(--green)' }}>{pk.criticalSegments ?? 0}</div><div className="kpi-sub">{t.pipeline.requireAttention}</div></div>
        <div className="kpi-card" style={{ '--kpi-color': pk.nrwPercent > 20 ? 'var(--red)' : pk.nrwPercent > 10 ? 'var(--amber)' : 'var(--green)' }}><div className="kpi-icon">📉</div><div className="kpi-label">{t.pipeline.estNrw}</div><div className="kpi-value" style={{ color: pk.nrwPercent > 20 ? 'var(--red)' : pk.nrwPercent > 10 ? 'var(--amber)' : 'var(--green)' }}>{pk.nrwPercent != null ? `${pk.nrwPercent}%` : '—'}</div><div className="kpi-sub">{t.pipeline.nonRevenueWater}</div></div>
      </div>

      <div className="tabs">{TABS.map(tb => <button key={tb.id} className={`tab-btn${tab === tb.id ? ' active' : ''}`} onClick={() => setTab(tb.id)}>{tb.label}</button>)}</div>

      {tab === 'overview' && (
        <>
          {!pipeline?.hasPipelineData ? (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="alert alert-warning">{t.pipeline.noPipelineData} {t.pipeline.addColumns} <code>pipe_segment</code>, <code>pressure</code>, <code>flow_rate</code>, <code>leakage</code>.</div>
              <div className="no-data-state" style={{ padding: '30px 0' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔧</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.pipeline.pipelineReady}</div></div>
            </div>
          ) : (
            <div className="grid-2" style={{ marginBottom: 20 }}>
              {segChartData && (
                <div className="card"><div className="card-header"><span className="card-title">{t.pipeline.segmentLeakage}</span></div><div className="chart-container" style={{ height: 240 }}><Bar data={segChartData} options={CHART_OPTS} /></div></div>
              )}
              <div className="card">
                <div className="card-header"><span className="card-title">{t.pipeline.networkHealth}</span><span className="badge badge-gray">{totalSegs} {t.pipeline.segments}</span></div>
                {totalSegs > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div className="chart-container" style={{ height: 200, flex: 1 }}>
                      <Doughnut data={doughnutData} options={{ ...CHART_OPTS, scales: undefined, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } } }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      {[{ label: t.pipeline.critical, val: pk.criticalSegments, color: 'var(--red)' }, { label: t.pipeline.warning, val: pk.warningSegments, color: 'var(--amber)' }, { label: t.pipeline.normal, val: pk.normalSegments, color: 'var(--green)' }].map(r => (
                        <div key={r.label} className="stat-row"><span className="stat-label"><span className={`status-dot ${r.label.toLowerCase()}`} />{r.label}</span><span className="stat-value" style={{ color: r.color }}>{r.val ?? 0}</span></div>
                      ))}
                      {pipeline.pressureTrend && <div className="stat-row"><span className="stat-label">{t.pipeline.pressureTrend}</span><span className="stat-value" style={{ color: pipeline.pressureTrend === 'Increasing' ? 'var(--amber)' : pipeline.pressureTrend === 'Decreasing' ? 'var(--red)' : 'var(--green)' }}>{pipeline.pressureTrend}</span></div>}
                      {pk.totalLoss != null && <div className="stat-row"><span className="stat-label">{t.pipeline.totalLoss}</span><span className="stat-value" style={{ color: 'var(--red)' }}>{pk.totalLoss.toLocaleString()}</span></div>}
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No segment breakdown available.</div>}
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-header"><span className="card-title">{t.pipeline.systemPerformance}</span></div>
            <div className="grid-2" style={{ gap: 12 }}>
              {[{ label: t.pipeline.pressureColumn, value: pipeline?.pressureCol || t.pipeline.notDetected, color: 'var(--cyan)' }, { label: t.pipeline.flowColumn, value: pipeline?.flowCol || t.pipeline.notDetected, color: 'var(--blue)' }, { label: t.pipeline.pressureTrend, value: pipeline?.pressureTrend || t.common.na, color: 'var(--amber)' }, { label: t.pipeline.nrwEstimate, value: pk.nrwPercent != null ? `${pk.nrwPercent}%` : t.common.na, color: pk.nrwPercent > 20 ? 'var(--red)' : 'var(--green)' }].map(r => (
                <div key={r.label} className="stat-row"><span className="stat-label">{r.label}</span><span className="stat-value" style={{ color: r.color }}>{r.value}</span></div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'segments' && (
        <div className="card">
          <div className="card-header"><span className="card-title">{t.pipeline.segmentAnalysis}</span><span className="badge badge-gray">{segments.length} {t.pipeline.segments}</span></div>
          {segments.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>{t.pipeline.segment}</th><th>{t.pipeline.avgPressure}</th><th>{t.pipeline.avgFlow}</th><th>{t.pipeline.avgLoss}</th><th>{t.pipeline.leakageScore}</th><th>{t.pipeline.riskBar}</th><th>{t.pipeline.status}</th><th>{t.pipeline.recordCount}</th></tr></thead>
                <tbody>
                  {segments.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.segment}</td>
                      <td>{s.avgPressure != null ? s.avgPressure.toFixed(2) : '—'}</td>
                      <td>{s.avgFlow != null ? s.avgFlow.toFixed(2) : '—'}</td>
                      <td style={{ color: s.avgLoss > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{s.avgLoss != null ? s.avgLoss.toFixed(2) : '—'}</td>
                      <td style={{ fontWeight: 700, color: STATUS_COLOR[s.status] }}>{s.leakageScore.toFixed(1)}</td>
                      <td style={{ minWidth: 100 }}><LeakBar score={s.leakageScore} status={s.status} /></td>
                      <td><span className={`badge ${BADGE_CLASS[s.status]}`}><span className={`status-dot ${s.status.toLowerCase()}`} />{localStatus(s.status)}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.recordCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="alert alert-warning">{t.pipeline.noSegments}</div>}
        </div>
      )}

      {tab === 'climate' && (
        <div className="card">
          <div className="card-header"><span className="card-title">{t.pipeline.climateInsights}</span></div>
          {climateInsights?.length > 0 ? (
            <>
              {climateInsights.map((ins, i) => (
                <div key={i} className={`insight-card ${ins.type}`}>
                  <div className="insight-icon">{ins.icon}</div>
                  <div><div className="insight-title">{ins.title}</div><div className="insight-msg">{ins.message}</div></div>
                </div>
              ))}
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>{t.pipeline.sustainabilityRec}</h4>
                {[{ icon: '💡', text: t.pipeline.iotSensors }, { icon: '🔄', text: t.pipeline.dmaZones }, { icon: '♻️', text: t.pipeline.greywater }, { icon: '📡', text: t.pipeline.smartAmi }, { icon: '🌧️', text: t.pipeline.rainwater }].map((r, i) => (
                  <div key={i} className="insight-card info" style={{ marginBottom: 8 }}><div className="insight-icon">{r.icon}</div><div className="insight-msg">{r.text}</div></div>
                ))}
              </div>
            </>
          ) : <div className="alert alert-info">{t.pipeline.uploadDataForInsights}</div>}
        </div>
      )}
    </div>
  );
}
