import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 10 } },
    y: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } },
  },
};

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

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/predictions').then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-wrapper"><div className="loading-center"><div className="spinner" /><span>{t.dashboard.loadingDashboard}</span></div></div>
  );

  if (!data?.predictions) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">{t.dashboard.title}</h1><p className="page-subtitle">{t.dashboard.welcome} {user?.name}</p></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">💧</div>
          <div className="no-data-title">{t.dashboard.noData}</div>
          <div className="no-data-sub">{t.dashboard.noDataSub}</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/upload')}>{t.dashboard.uploadCsvBtn}</button>
        </div>
      </div>
    </div>
  );

  const { kpis, forecast, columnSummary, climateInsights } = data.predictions;
  const trendColor = kpis.overallTrend === 'Increasing' ? 'var(--red)' : kpis.overallTrend === 'Decreasing' ? 'var(--green)' : 'var(--cyan)';
  const leakColor  = kpis.leakageRisk === 'Critical' ? 'var(--red)' : kpis.leakageRisk === 'Warning' ? 'var(--amber)' : 'var(--green)';

  const trendChartRaw = data.predictions.trendChart;
  const chartData = trendChartRaw ? {
    labels: trendChartRaw.labels,
    datasets: [
      { label: `${kpis.primaryMetric} (Actual)`, data: trendChartRaw.actual, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.3, pointRadius: 2 },
      { label: t.analytics.movingAvg, data: trendChartRaw.movingAvg, borderColor: '#06b6d4', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0, borderDash: [4,2] },
    ],
  } : null;

  const localTrend = (trend) => trend === 'Increasing' ? t.common.increasing : trend === 'Decreasing' ? t.common.decreasing : t.common.stable;
  const localRisk  = (r) => r === 'High' ? t.common.high : r === 'Medium' ? t.common.medium : t.common.low;

  return (
    <div className="page-wrapper">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">{t.dashboard.title}</h1>
          <p className="page-subtitle">{t.dashboard.dataset} <strong style={{ color: 'var(--cyan)' }}>{data.originalName}</strong> · {t.dashboard.lastUpdated} {new Date(data.uploadedAt).toLocaleDateString()}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/upload')}>{t.dashboard.updateDataset}</button>
      </div>

      <div className="kpi-grid">
        <KpiCard label={t.dashboard.totalRecords}    value={kpis.totalRows?.toLocaleString()} icon="📋" color="var(--cyan)"   sub={t.dashboard.rowsInDataset} />
        <KpiCard label={t.dashboard.avgConsumption}  value={kpis.primaryMean != null ? kpis.primaryMean.toFixed(1) : '—'} icon="📌" color="var(--blue)"   sub={kpis.primaryMetric !== 'N/A' ? kpis.primaryMetric : t.dashboard.primaryMetric} />
        <KpiCard label={t.dashboard.overallTrend}    value={localTrend(kpis.overallTrend)} icon="📈" color={trendColor}  sub={t.dashboard.linearRegression} />
        <KpiCard label={t.dashboard.efficiencyScore} value={kpis.efficiencyScore != null ? `${kpis.efficiencyScore}%` : '—'} icon="⚡" color="var(--green)"  sub={t.dashboard.consistencyScore} />
      </div>
      <div className="kpi-grid">
        <KpiCard label={t.dashboard.anomalies}       value={kpis.totalAnomalies}  icon="⚠️" color={kpis.totalAnomalies > 10 ? 'var(--red)' : 'var(--amber)'} sub={t.dashboard.detectedOutliers} />
        <KpiCard label={t.dashboard.leakageRisk}     value={kpis.leakageRisk || t.common.na} icon="💧" color={leakColor} sub={t.dashboard.pipelineStatus} />
        <KpiCard label={t.dashboard.forecastConf}    value={kpis.forecastConfidence || '—'} icon="🔮" color="var(--purple)"  sub={t.dashboard.predictionQuality} />
        <KpiCard label={t.dashboard.criticalPipes}   value={kpis.criticalPipeSegments ?? '—'} icon="🔧" color={kpis.criticalPipeSegments > 0 ? 'var(--red)' : 'var(--green)'} sub={t.dashboard.segmentsAtRisk} />
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {chartData ? (
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t.dashboard.historicalTrend}</span>
              <span className={`badge badge-${kpis.overallTrend === 'Increasing' ? 'red' : kpis.overallTrend === 'Decreasing' ? 'green' : 'cyan'}`}>{localTrend(kpis.overallTrend)}</span>
            </div>
            <div className="chart-container" style={{ height: 220 }}><Line data={chartData} options={CHART_OPTS} /></div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header"><span className="card-title">{t.dashboard.historicalTrend}</span></div>
            <div className="no-data-state" style={{ padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.dashboard.noTimeSeries}</div>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.dashboard.forecastSummary}</span>
            {forecast && <span className="badge badge-purple">{forecast.summary?.confidence} Confidence</span>}
          </div>
          {forecast ? (
            <>
              <div className="stat-row"><span className="stat-label">{t.dashboard.primaryMetricLabel}</span><span className="stat-value" style={{ color: 'var(--cyan)' }}>{forecast.column}</span></div>
              <div className="stat-row"><span className="stat-label">{t.dashboard.next7DayAvg}</span><span className="stat-value">{forecast.summary.next7DayAvg?.toFixed(2)}</span></div>
              <div className="stat-row"><span className="stat-label">{t.dashboard.next14DayAvg}</span><span className="stat-value">{forecast.summary.next14DayAvg?.toFixed(2)}</span></div>
              <div className="stat-row"><span className="stat-label">{t.dashboard.trendDirection}</span><span className="stat-value" style={{ color: trendColor }}>{localTrend(forecast.summary.trend)}</span></div>
              <div className="stat-row"><span className="stat-label">{t.dashboard.method}</span><span className="stat-value" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{forecast.method}</span></div>
              <div className="stat-row"><span className="stat-label">{t.dashboard.datasetMinMax}</span><span className="stat-value">{kpis.primaryMin?.toFixed(1)} / {kpis.primaryMax?.toFixed(1)}</span></div>
              <div className="stat-row"><span className="stat-label">{t.dashboard.totalSum}</span><span className="stat-value">{kpis.primarySum?.toLocaleString()}</span></div>
              {kpis.nrwPercent != null && (
                <div className="stat-row"><span className="stat-label">{t.dashboard.estNrw}</span><span className="stat-value" style={{ color: kpis.nrwPercent > 20 ? 'var(--red)' : 'var(--green)' }}>{kpis.nrwPercent}%</span></div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>{t.dashboard.noForecastData}</div>
          )}
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/predict')}>{t.dashboard.viewPredictions}</button>
        </div>
      </div>

      {climateInsights?.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><span className="card-title">{t.dashboard.climateInsights}</span></div>
          {climateInsights.map((ins, i) => (
            <div key={i} className={`insight-card ${ins.type}`}>
              <div className="insight-icon">{ins.icon}</div>
              <div><div className="insight-title">{ins.title}</div><div className="insight-msg">{ins.message}</div></div>
            </div>
          ))}
        </div>
      )}

      {columnSummary?.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">{t.dashboard.columnAnalysis}</span><span className="badge badge-gray">{columnSummary.length} {t.dashboard.metrics}</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>{t.dashboard.column}</th><th>{t.dashboard.mean}</th><th>{t.dashboard.min}</th><th>{t.dashboard.max}</th><th>{t.dashboard.trend}</th><th>{t.dashboard.efficiency}</th><th>{t.dashboard.risk}</th><th>{t.dashboard.anomalyCount}</th></tr></thead>
              <tbody>
                {columnSummary.map(c => (
                  <tr key={c.column}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.column}</td>
                    <td>{c.mean?.toFixed(2)}</td><td>{c.min?.toFixed(2)}</td><td>{c.max?.toFixed(2)}</td>
                    <td><span className={`badge badge-${c.trend === 'Increasing' ? 'red' : c.trend === 'Decreasing' ? 'green' : 'cyan'}`}>{localTrend(c.trend)}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 40, height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                          <div style={{ width: `${c.efficiencyScore}%`, height: '100%', background: 'var(--green)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{c.efficiencyScore}%</span>
                      </div>
                    </td>
                    <td><span className={`badge badge-${c.riskLevel === 'High' ? 'red' : c.riskLevel === 'Medium' ? 'amber' : 'green'}`}>{localRisk(c.riskLevel)}</span></td>
                    <td style={{ color: c.anomalyCount > 5 ? 'var(--red)' : 'var(--text-secondary)' }}>{c.anomalyCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
