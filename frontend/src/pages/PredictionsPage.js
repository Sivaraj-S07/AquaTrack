import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler } from 'chart.js';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 10 } },
    y: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } },
  },
};

export default function PredictionsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [pred, setPred] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('forecast');

  useEffect(() => {
    Promise.all([api.get('/predictions/forecast'), api.get('/predictions/anomalies'), api.get('/predictions/columns')])
      .then(([fc, an, co]) => setPred({ forecast: fc.data, anomalies: an.data, columns: co.data }))
      .catch(() => setPred(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-wrapper"><div className="loading-center"><div className="spinner" /><span>{t.predictions.loading}</span></div></div>;

  if (!pred?.forecast?.forecast) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">{t.predictions.title}</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">🔮</div>
          <div className="no-data-title">{t.predictions.noData}</div>
          <div className="no-data-sub">{t.predictions.noDataSub}</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/upload')}>📤 Upload CSV</button>
        </div>
      </div>
    </div>
  );

  const { forecast: { forecast, trendChart, kpis }, anomalies: { anomalies }, columns: { columnSummary } } = pred;
  const localTrend = (trend) => trend === 'Increasing' ? t.common.increasing : trend === 'Decreasing' ? t.common.decreasing : t.common.stable;
  const localRisk  = (r) => r === 'High' ? t.common.high : r === 'Medium' ? t.common.medium : t.common.low;

  const forecastChartData = {
    labels: forecast.forecastLabels,
    datasets: [{ label: `${forecast.column} Forecast`, data: forecast.nextPeriodValues, borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.08)', fill: true, tension: 0.4, pointRadius: 3, borderDash: [5,3] }],
  };

  const combinedChartData = trendChart ? {
    labels: [...trendChart.labels, ...forecast.forecastLabels],
    datasets: [
      { label: 'Historical (Actual)', data: [...trendChart.actual, ...Array(forecast.forecastLabels.length).fill(null)], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.3, pointRadius: 2 },
      { label: t.analytics.movingAvg, data: [...trendChart.movingAvg, ...Array(forecast.forecastLabels.length).fill(null)], borderColor: '#14b8a6', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0, borderDash: [3,2] },
      { label: 'Forecast', data: [...Array(trendChart.labels.length).fill(null), ...forecast.nextPeriodValues], borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4, pointRadius: 3, borderDash: [5,3] },
    ],
  } : forecastChartData;

  const anomalySeverityData = anomalies?.length ? {
    labels: anomalies.slice(0, 20).map((_, i) => `#${i + 1}`),
    datasets: [{ label: t.predictions.forecastValue, data: anomalies.slice(0, 20).map(a => a.value),
      backgroundColor: anomalies.slice(0, 20).map(a => a.severity === 'high' ? 'rgba(239,68,68,0.7)' : 'rgba(245,158,11,0.7)'),
      borderColor: anomalies.slice(0, 20).map(a => a.severity === 'high' ? '#ef4444' : '#f59e0b'), borderWidth: 1, borderRadius: 3 }],
  } : null;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">{t.predictions.title}</h1>
        <p className="page-subtitle">{forecast.method} · {forecast.summary.confidence} {t.predictions.confidence}</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--kpi-color': 'var(--cyan)' }}><div className="kpi-icon">📌</div><div className="kpi-label">{t.predictions.primaryMetric}</div><div className="kpi-value" style={{ color: 'var(--cyan)', fontSize: 16 }}>{forecast.column}</div></div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--blue)' }}><div className="kpi-icon">📅</div><div className="kpi-label">{t.predictions.sevenDayForecast}</div><div className="kpi-value" style={{ color: 'var(--blue)' }}>{forecast.summary.next7DayAvg?.toFixed(1)}</div></div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--purple)' }}><div className="kpi-icon">📆</div><div className="kpi-label">{t.predictions.fourteenDayForecast}</div><div className="kpi-value" style={{ color: 'var(--purple)' }}>{forecast.summary.next14DayAvg?.toFixed(1)}</div></div>
        <div className="kpi-card" style={{ '--kpi-color': kpis?.totalAnomalies > 10 ? 'var(--red)' : 'var(--amber)' }}><div className="kpi-icon">⚠️</div><div className="kpi-label">{t.predictions.anomaliesDetected}</div><div className="kpi-value" style={{ color: kpis?.totalAnomalies > 10 ? 'var(--red)' : 'var(--amber)' }}>{kpis?.totalAnomalies ?? 0}</div></div>
      </div>

      <div className="tabs">
        {[{ id: 'forecast', label: t.predictions.combinedForecast }, { id: 'anomalies', label: t.predictions.anomalyReport }, { id: 'columns', label: t.predictions.columnAnalysis }].map(tab2 => (
          <button key={tab2.id} className={`tab-btn${tab === tab2.id ? ' active' : ''}`} onClick={() => setTab(tab2.id)}>{tab2.label}</button>
        ))}
      </div>

      {tab === 'forecast' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">{t.predictions.historicalForecast}</span>
              <span className={`badge badge-${forecast.summary.trend === 'Increasing' ? 'red' : forecast.summary.trend === 'Decreasing' ? 'green' : 'cyan'}`}>{localTrend(forecast.summary.trend)}</span>
            </div>
            <div className="chart-container" style={{ height: 280 }}><Line data={combinedChartData} options={CHART_OPTS} /></div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">{t.predictions.forecastValues}</span></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>{t.predictions.index}</th><th>{t.predictions.datePeriod}</th><th>{t.predictions.forecastValue}</th><th>{t.predictions.vsAvg}</th></tr></thead>
                <tbody>
                  {forecast.forecastLabels.map((lbl, i) => {
                    const val = forecast.nextPeriodValues[i];
                    const avg = kpis?.primaryMean;
                    const diff = avg ? ((val - avg) / avg * 100).toFixed(1) : null;
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lbl}</td>
                        <td style={{ color: 'var(--cyan)', fontWeight: 600 }}>{val?.toFixed(2)}</td>
                        <td>{diff != null && <span style={{ color: parseFloat(diff) > 0 ? 'var(--amber)' : 'var(--green)', fontSize: 12 }}>{parseFloat(diff) > 0 ? '▲' : '▼'} {Math.abs(diff)}%</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'anomalies' && (
        <>
          {anomalySeverityData && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">{t.predictions.top20Anomalies}</span><span className="badge badge-red">{anomalies?.length} {t.predictions.total}</span></div>
              <div className="chart-container" style={{ height: 220 }}><Bar data={anomalySeverityData} options={CHART_OPTS} /></div>
            </div>
          )}
          <div className="card">
            <div className="card-header"><span className="card-title">{t.predictions.anomalyDetails}</span></div>
            {anomalies?.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>{t.predictions.rowIndex}</th><th>{t.predictions.value}</th><th>{t.predictions.threshold}</th><th>{t.predictions.severity}</th></tr></thead>
                  <tbody>
                    {anomalies.slice(0, 50).map((a, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{t.predictions.rowIndex} {a.index + 1}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.value?.toFixed(2)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{a.threshold?.toFixed(2)}</td>
                        <td><span className={`badge badge-${a.severity === 'high' ? 'red' : 'amber'}`}>{a.severity === 'high' ? t.predictions.high : t.predictions.low}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>{t.predictions.noAnomalies}</div>}
          </div>
        </>
      )}

      {tab === 'columns' && (
        <div className="card">
          <div className="card-header"><span className="card-title">{t.predictions.perColumnAnalysis}</span><span className="badge badge-cyan">{columnSummary?.length} {t.predictions.columns}</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>{t.dashboard.column}</th><th>{t.dashboard.mean}</th><th>{t.predictions.median}</th><th>{t.predictions.stdDev}</th><th>{t.dashboard.min}</th><th>{t.dashboard.max}</th><th>{t.dashboard.trend}</th><th>{t.dashboard.efficiency}</th><th>{t.dashboard.risk}</th><th>{t.dashboard.anomalyCount}</th></tr></thead>
              <tbody>
                {columnSummary?.map(c => (
                  <tr key={c.column}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.column}</td>
                    <td>{c.mean?.toFixed(2)}</td><td>{c.median?.toFixed(2)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.std?.toFixed(2)}</td>
                    <td>{c.min?.toFixed(2)}</td><td>{c.max?.toFixed(2)}</td>
                    <td><span className={`badge badge-${c.trend === 'Increasing' ? 'red' : c.trend === 'Decreasing' ? 'green' : 'cyan'}`}>{localTrend(c.trend)}</span></td>
                    <td><span style={{ fontSize: 13, fontWeight: 600, color: c.efficiencyScore > 70 ? 'var(--green)' : 'var(--amber)' }}>{c.efficiencyScore}%</span></td>
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
