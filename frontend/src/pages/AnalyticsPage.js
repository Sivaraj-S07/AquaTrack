import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler);

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 12 } },
    y: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } },
  },
};
const DONUT_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 10 } } } };
const PALETTE = ['#06b6d4','#3b82f6','#22c55e','#f59e0b','#a855f7','#14b8a6','#ef4444','#8b5cf6','#ec4899','#f97316'];

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/predictions/zones'), api.get('/predictions/leakage'), api.get('/predictions/forecast')])
      .then(([z, l, f]) => setData({ zones: z.data, leakage: l.data, forecast: f.data }))
      .catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-wrapper"><div className="loading-center"><div className="spinner" /><span>{t.analytics.loading}</span></div></div>;

  if (!data?.zones) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">{t.analytics.title}</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">📊</div>
          <div className="no-data-title">{t.analytics.noData}</div>
          <div className="no-data-sub">{t.analytics.noDataSub}</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/upload')}>{t.analytics.uploadCsv}</button>
        </div>
      </div>
    </div>
  );

  const { zones: { zoneDistribution, categoryCharts }, leakage: { leakageRisk }, forecast: { trendChart, kpis } } = data;

  const zoneChart = zoneDistribution?.length ? {
    labels: zoneDistribution.map(z => z.zone),
    datasets: [{ label: t.analytics.totalConsumption, data: zoneDistribution.map(z => z.total),
      backgroundColor: zoneDistribution.map((_, i) => `${PALETTE[i % PALETTE.length]}cc`),
      borderColor: zoneDistribution.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 1, borderRadius: 4 }],
  } : null;

  const zoneAvgChart = zoneDistribution?.length ? {
    labels: zoneDistribution.map(z => z.zone),
    datasets: [{ label: t.analytics.average, data: zoneDistribution.map(z => z.avg),
      backgroundColor: zoneDistribution.map((_, i) => `${PALETTE[i % PALETTE.length]}99`),
      borderColor: zoneDistribution.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 1, borderRadius: 4 }],
  } : null;

  const trendChartData = trendChart ? {
    labels: trendChart.labels,
    datasets: [
      { label: t.analytics.actual, data: trendChart.actual, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.3, pointRadius: 2 },
      { label: t.analytics.movingAvg, data: trendChart.movingAvg, borderColor: '#06b6d4', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0, borderDash: [4,2] },
    ],
  } : null;

  const localTrend = (trend) => trend === 'Increasing' ? t.common.increasing : trend === 'Decreasing' ? t.common.decreasing : t.common.stable;

  return (
    <div className="page-wrapper">
      <div className="page-header flex-between">
        <div><h1 className="page-title">{t.analytics.title}</h1><p className="page-subtitle">{t.analytics.subtitle}</p></div>
      </div>

      {leakageRisk && (
        <div className={`alert alert-${leakageRisk.severity === 'Critical' ? 'error' : leakageRisk.severity === 'Warning' ? 'warning' : 'success'}`} style={{ marginBottom: 20 }}>
          {leakageRisk.severity === 'Critical' ? '🚨' : leakageRisk.severity === 'Warning' ? '⚠️' : '✅'}
          {' '}<strong>{t.analytics.leakageStatus} {leakageRisk.severity}</strong>
          {' — '}{leakageRisk.anomalyCount} {t.analytics.pressureAnomalies} <em>{leakageRisk.column}</em>
          {leakageRisk.riskScore > 0 && ` (${t.analytics.riskScore} ${leakageRisk.riskScore})`}
        </div>
      )}

      {trendChartData && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">{t.analytics.waterUsageTrend}</span>
            {kpis && <span className={`badge badge-${kpis.overallTrend === 'Increasing' ? 'red' : kpis.overallTrend === 'Decreasing' ? 'green' : 'cyan'}`}>{localTrend(kpis.overallTrend)}</span>}
          </div>
          <div className="chart-container" style={{ height: 240 }}><Line data={trendChartData} options={CHART_OPTS} /></div>
        </div>
      )}

      {zoneDistribution?.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">{t.analytics.zoneTotalConsumption}</span><span className="badge badge-cyan">{zoneDistribution.length} {t.analytics.zones}</span></div>
            <div className="chart-container" style={{ height: 240 }}><Bar data={zoneChart} options={CHART_OPTS} /></div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">{t.analytics.zoneAvgConsumption}</span></div>
            <div className="chart-container" style={{ height: 240 }}><Bar data={zoneAvgChart} options={CHART_OPTS} /></div>
          </div>
        </div>
      )}

      {zoneDistribution?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">{t.analytics.zoneBreakdown}</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>{t.analytics.zone}</th><th>{t.analytics.totalConsumption}</th><th>{t.analytics.average}</th><th>{t.analytics.records}</th><th>{t.analytics.efficiency}</th><th>{t.analytics.anomalies}</th></tr></thead>
              <tbody>
                {zoneDistribution.map((z, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: PALETTE[i % PALETTE.length] }}>{z.zone}</td>
                    <td style={{ fontWeight: 600 }}>{z.total?.toLocaleString()}</td>
                    <td>{z.avg?.toFixed(2)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{z.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 50, height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                          <div style={{ width: `${z.efficiency}%`, height: '100%', background: 'var(--green)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{z.efficiency}%</span>
                      </div>
                    </td>
                    <td style={{ color: z.anomalies > 2 ? 'var(--red)' : 'var(--text-muted)' }}>{z.anomalies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {categoryCharts?.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">{t.analytics.categoryDist}</span><span className="badge badge-gray">{categoryCharts.length} {t.analytics.columns}</span></div>
          <div className="grid-2">
            {categoryCharts.map((cc, i) => (
              <div key={i}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>{cc.column}</div>
                <div className="chart-container" style={{ height: 200 }}>
                  <Doughnut data={{ labels: cc.labels, datasets: [{ data: cc.values, backgroundColor: PALETTE.map(c => `${c}cc`), borderColor: PALETTE, borderWidth: 1 }] }} options={DONUT_OPTS} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
