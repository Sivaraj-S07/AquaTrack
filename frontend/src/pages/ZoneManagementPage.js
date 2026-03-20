/**
 * ZoneManagementPage
 * All data comes exclusively from the uploaded CSV via:
 *   GET /api/predictions/zones   → zoneDistribution, categoryCharts
 *   GET /api/predictions/pipeline → pipeline.segments, kpis
 * Nothing is hardcoded. Missing columns are surfaced with clear guidance.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend,
} from 'chart.js';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 30 } },
    y: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } },
  },
};
const PALETTE = ['#06b6d4','#3b82f6','#22c55e','#f59e0b','#a855f7','#f97316','#14b8a6','#ef4444','#ec4899','#8b5cf6'];
const SEV_COLOR = { Critical: 'var(--red)', Warning: 'var(--amber)', Normal: 'var(--green)' };
const SEV_BADGE = { Critical: 'badge-red', Warning: 'badge-amber', Normal: 'badge-green' };

function MissingDataNotice({ title, message, columns }) {
  return (
    <div style={{
      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 10, padding: '16px 20px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: 4, fontSize: 13 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{message}</div>
          {columns && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {columns.map(c => (
                <code key={c} style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{c}</code>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ZoneManagementPage() {
  const navigate = useNavigate();
  const { t }    = useI18n();
  const [loading, setLoading]   = useState(true);
  const [zones,   setZones]     = useState([]);
  const [segments,setSegments]  = useState([]);
  const [pipeKpis,setPipeKpis]  = useState(null);
  const [catCharts,setCatCharts]= useState([]);
  const [missingZone, setMissingZone]     = useState(false);
  const [missingPipeline,setMissingPipeline] = useState(false);
  const [tab, setTab]           = useState('overview');
  const [selectedZone, setSelectedZone] = useState(null);
  const [noDataset, setNoDataset] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/predictions/zones'),
      api.get('/predictions/pipeline'),
    ])
      .then(([zr, pr]) => {
        const zd = zr.data?.zoneDistribution || [];
        const cc = zr.data?.categoryCharts || [];
        const segs = pr.data?.pipeline?.segments || [];
        const kpis = pr.data?.pipeline?.kpis || null;

        setZones(zd);
        setSegments(segs);
        setPipeKpis(kpis);
        setCatCharts(cc);
        setMissingZone(zd.length === 0);
        setMissingPipeline(!pr.data?.pipeline?.hasPipelineData);
        if (zd.length > 0) setSelectedZone(zd[0].zone);
      })
      .catch(err => {
        if (err?.response?.status === 404) setNoDataset(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-center"><div className="spinner" /><span>Loading zone data…</span></div>
    </div>
  );

  if (noDataset) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">🏙️ Zone Management</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">📤</div>
          <div className="no-data-title">No dataset uploaded yet</div>
          <div className="no-data-sub">Upload a CSV file to begin. Zone management requires a <code>zone</code> / <code>area</code> column plus numeric consumption data. Pipeline segments need a <code>segment</code> column with <code>pressure</code> / <code>flow_rate</code> data.</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/upload')}>📤 Upload CSV Dataset</button>
        </div>
      </div>
    </div>
  );

  const hasAny = zones.length > 0 || segments.length > 0;

  // ── Derived KPIs ────────────────────────────────────────────
  const totalConsumption = zones.reduce((s, z) => s + (z.total || 0), 0);
  const critCount        = zones.filter(z => (z.efficiency || 0) < 70).length;
  const avgEfficiency    = zones.length
    ? (zones.reduce((s, z) => s + (z.efficiency || 0), 0) / zones.length).toFixed(1) : null;

  const selectedObj = zones.find(z => z.zone === selectedZone);

  // ── Charts ──────────────────────────────────────────────────
  const inflowChart = zones.length > 0 ? {
    labels: zones.map(z => z.zone),
    datasets: [{
      label: 'Total Consumption',
      data: zones.map(z => z.total),
      backgroundColor: zones.map((_, i) => PALETTE[i % PALETTE.length] + 'bb'),
      borderColor:     zones.map((_, i) => PALETTE[i % PALETTE.length]),
      borderWidth: 2, borderRadius: 4,
    }],
  } : null;

  const effChart = zones.length > 0 ? {
    labels: zones.map(z => z.zone),
    datasets: [{
      label: 'Efficiency %',
      data: zones.map(z => z.efficiency || 0),
      backgroundColor: zones.map(z => (z.efficiency||0) >= 90 ? 'rgba(34,197,94,0.6)' : (z.efficiency||0) >= 75 ? 'rgba(245,158,11,0.6)' : 'rgba(239,68,68,0.6)'),
      borderColor:     zones.map(z => (z.efficiency||0) >= 90 ? '#22c55e' : (z.efficiency||0) >= 75 ? '#f59e0b' : '#ef4444'),
      borderWidth: 2, borderRadius: 4,
    }],
  } : null;

  const segChart = segments.length > 0 ? {
    labels: segments.map(s => s.segment),
    datasets: [{
      label: 'Leakage Score',
      data: segments.map(s => s.leakageScore),
      backgroundColor: segments.map(s => s.status === 'Critical' ? 'rgba(239,68,68,0.7)' : s.status === 'Warning' ? 'rgba(245,158,11,0.7)' : 'rgba(34,197,94,0.5)'),
      borderColor:     segments.map(s => SEV_COLOR[s.status]),
      borderWidth: 1, borderRadius: 4,
    }],
  } : null;

  const pieData = zones.length > 0 ? {
    labels: zones.map(z => z.zone),
    datasets: [{
      data: zones.map(z => z.total),
      backgroundColor: zones.map((_, i) => PALETTE[i % PALETTE.length] + 'bb'),
      borderColor:     zones.map((_, i) => PALETTE[i % PALETTE.length]),
      borderWidth: 2,
    }],
  } : null;

  const TABS = [
    { id: 'overview', label: '🏙️ Overview' },
    ...(zones.length > 0    ? [{ id: 'zones',    label: `🗺️ Zone Details (${zones.length})` }]      : []),
    ...(segments.length > 0 ? [{ id: 'segments', label: `🔩 Segments (${segments.length})` }]       : []),
    ...(catCharts.length > 0? [{ id: 'cats',     label: `📂 Categories (${catCharts.length})` }]    : []),
    { id: 'analysis', label: '📊 Analysis' },
  ];

  const zoneStatus = (eff) => (eff < 70 ? 'Critical' : eff < 85 ? 'Warning' : 'Normal');

  return (
    <div className="page-wrapper">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">🏙️ Zone Management</h1>
          <p className="page-subtitle">All data sourced exclusively from your uploaded CSV file</p>
        </div>
      </div>

      {/* Missing-data notices */}
      {missingZone && (
        <MissingDataNotice
          title="Zone column not detected in your CSV"
          message="Zone-level analytics require a categorical column identifying each zone, area or district. Add one of these columns to unlock zone breakdown, charts and cross-zone analysis:"
          columns={['zone', 'area', 'district', 'region', 'sector', 'location', 'block', 'ward']}
        />
      )}
      {missingPipeline && (
        <MissingDataNotice
          title="Pipeline segment column not detected in your CSV"
          message="Pipeline visualization requires a segment identifier column plus pressure / flow / leakage numeric columns:"
          columns={['pipe_segment', 'segment', 'pipeline', 'pressure', 'flow_rate', 'leakage', 'loss']}
        />
      )}

      {!hasAny && (
        <div className="card">
          <div className="no-data-state">
            <div className="no-data-icon">🏙️</div>
            <div className="no-data-title">No zone or pipeline data in this CSV</div>
            <div className="no-data-sub">Your uploaded file does not contain zone or pipeline columns. See the notices above for which columns to add, or try one of the provided sample datasets (01_full_featured.csv or 02_zone_only.csv).</div>
          </div>
        </div>
      )}

      {hasAny && (
        <>
          {/* KPI row */}
          <div className="kpi-grid">
            <div className="kpi-card" style={{ '--kpi-color': 'var(--cyan)' }}>
              <div className="kpi-icon">🌊</div>
              <div className="kpi-label">Total Consumption</div>
              <div className="kpi-value" style={{ color: 'var(--cyan)', fontSize: zones.length ? 26 : 18 }}>
                {zones.length ? totalConsumption.toLocaleString(undefined,{maximumFractionDigits:0}) : '—'}
              </div>
              <div className="kpi-sub">{zones.length ? `across ${zones.length} zones` : 'no zone column'}</div>
            </div>
            <div className="kpi-card" style={{ '--kpi-color': 'var(--blue)' }}>
              <div className="kpi-icon">🗺️</div>
              <div className="kpi-label">Zones Detected</div>
              <div className="kpi-value" style={{ color: 'var(--blue)' }}>{zones.length || '—'}</div>
              <div className="kpi-sub">from CSV zone column</div>
            </div>
            <div className="kpi-card" style={{ '--kpi-color': critCount > 0 ? 'var(--red)' : 'var(--green)' }}>
              <div className="kpi-icon">🚨</div>
              <div className="kpi-label">Low Efficiency Zones</div>
              <div className="kpi-value" style={{ color: critCount > 0 ? 'var(--red)' : 'var(--green)' }}>{zones.length ? critCount : '—'}</div>
              <div className="kpi-sub">efficiency below 70%</div>
            </div>
            <div className="kpi-card" style={{ '--kpi-color': 'var(--purple)' }}>
              <div className="kpi-icon">🔧</div>
              <div className="kpi-label">Pipeline Segments</div>
              <div className="kpi-value" style={{ color: 'var(--purple)' }}>{segments.length || '—'}</div>
              <div className="kpi-sub">{segments.length ? `${pipeKpis?.criticalSegments||0} critical` : 'no segment column'}</div>
            </div>
          </div>

          <div className="tabs">
            {TABS.map(tb => <button key={tb.id} className={`tab-btn${tab===tb.id?' active':''}`} onClick={()=>setTab(tb.id)}>{tb.label}</button>)}
          </div>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <>
              {zones.length > 0 ? (
                <div className="grid-2" style={{ marginBottom: 20 }}>
                  <div className="card">
                    <div className="card-header"><span className="card-title">TOTAL CONSUMPTION BY ZONE</span></div>
                    <div className="chart-container" style={{ height: 260 }}><Bar data={inflowChart} options={CHART_OPTS} /></div>
                  </div>
                  <div className="card">
                    <div className="card-header"><span className="card-title">ZONE EFFICIENCY SCORE (%)</span></div>
                    <div className="chart-container" style={{ height: 260 }}><Bar data={effChart} options={CHART_OPTS} /></div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="no-data-state" style={{ padding: '40px 20px' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No zone column found — zone charts not available</div>
                  </div>
                </div>
              )}
              {zones.length > 0 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">ZONE SUMMARY TABLE</span><span className="badge badge-gray">{zones.length} zones from CSV</span></div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Zone</th><th>Total</th><th>Average</th><th>Records</th><th>Anomalies</th><th>Efficiency</th><th>Status</th></tr></thead>
                      <tbody>
                        {zones.map((z, i) => {
                          const st = zoneStatus(z.efficiency || 0);
                          return (
                            <tr key={z.zone} style={{ cursor:'pointer' }} onClick={() => { setSelectedZone(z.zone); setTab('zones'); }}>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ width:10,height:10,borderRadius:'50%',background:PALETTE[i%PALETTE.length],display:'inline-block',flexShrink:0 }} />
                                  <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{z.zone}</span>
                                </div>
                              </td>
                              <td style={{ color:'var(--cyan)', fontWeight:600 }}>{z.total?.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                              <td>{z.avg?.toFixed(2)}</td>
                              <td style={{ color:'var(--text-muted)' }}>{z.count?.toLocaleString()}</td>
                              <td style={{ color: z.anomalies > 0 ? 'var(--amber)' : 'var(--green)' }}>{z.anomalies}</td>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <div style={{ width:50, height:6, background:'rgba(255,255,255,0.06)', borderRadius:3 }}>
                                    <div style={{ width:`${z.efficiency||0}%`, height:'100%', background:(z.efficiency||0)>=90?'var(--green)':(z.efficiency||0)>=75?'var(--amber)':'var(--red)', borderRadius:3 }} />
                                  </div>
                                  <span style={{ fontSize:12 }}>{z.efficiency||0}%</span>
                                </div>
                              </td>
                              <td><span className={`badge ${SEV_BADGE[st]}`}>{st}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ZONE DETAILS */}
          {tab === 'zones' && zones.length > 0 && (
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                {zones.map((z, i) => (
                  <button key={z.zone}
                    className={`tab-btn${selectedZone===z.zone?' active':''}`}
                    style={{ borderLeft:`3px solid ${PALETTE[i%PALETTE.length]}` }}
                    onClick={() => setSelectedZone(z.zone)}>
                    {z.zone}
                  </button>
                ))}
              </div>
              {selectedObj && (() => {
                const st  = zoneStatus(selectedObj.efficiency||0);
                const idx = zones.findIndex(z => z.zone === selectedObj.zone);
                return (
                  <>
                    <div className="kpi-grid" style={{ marginBottom:20 }}>
                      <div className="kpi-card" style={{ '--kpi-color':'var(--cyan)' }}><div className="kpi-icon">🌊</div><div className="kpi-label">Total</div><div className="kpi-value" style={{ color:'var(--cyan)',fontSize:20 }}>{selectedObj.total?.toLocaleString(undefined,{maximumFractionDigits:2})}</div><div className="kpi-sub">consumption units</div></div>
                      <div className="kpi-card" style={{ '--kpi-color':'var(--blue)' }}><div className="kpi-icon">📊</div><div className="kpi-label">Average</div><div className="kpi-value" style={{ color:'var(--blue)',fontSize:20 }}>{selectedObj.avg?.toFixed(2)}</div><div className="kpi-sub">per record</div></div>
                      <div className="kpi-card" style={{ '--kpi-color': selectedObj.anomalies>0?'var(--amber)':'var(--green)' }}><div className="kpi-icon">⚠️</div><div className="kpi-label">Anomalies</div><div className="kpi-value" style={{ color:selectedObj.anomalies>0?'var(--amber)':'var(--green)' }}>{selectedObj.anomalies}</div><div className="kpi-sub">outliers detected</div></div>
                      <div className="kpi-card" style={{ '--kpi-color':SEV_COLOR[st] }}><div className="kpi-icon">✅</div><div className="kpi-label">Efficiency</div><div className="kpi-value" style={{ color:SEV_COLOR[st] }}>{selectedObj.efficiency||0}%</div><div className="kpi-sub">{st}</div></div>
                    </div>
                    <div className="grid-2">
                      <div className="card">
                        <div className="card-header"><span className="card-title">ZONE STATS</span><span className={`badge ${SEV_BADGE[st]}`}>{st}</span></div>
                        {[
                          { label:'Zone Name',      value:selectedObj.zone,                                                      color:PALETTE[idx%PALETTE.length] },
                          { label:'Total',           value:selectedObj.total?.toLocaleString(undefined,{maximumFractionDigits:2}), color:'var(--cyan)' },
                          { label:'Average / Record',value:selectedObj.avg?.toFixed(2),                                           color:'var(--blue)' },
                          { label:'Record Count',    value:selectedObj.count?.toLocaleString(),                                   color:'var(--text-secondary)' },
                          { label:'Anomaly Count',   value:selectedObj.anomalies,                                                  color:selectedObj.anomalies>0?'var(--amber)':'var(--green)' },
                          { label:'Efficiency Score',value:`${selectedObj.efficiency||0}%`,                                       color:SEV_COLOR[st] },
                        ].map(r => (
                          <div key={r.label} className="stat-row">
                            <span className="stat-label">{r.label}</span>
                            <span className="stat-value" style={{ color:r.color }}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="card">
                        <div className="card-header"><span className="card-title">SHARE OF TOTAL CONSUMPTION</span></div>
                        {pieData && (
                          <div className="chart-container" style={{ height:220 }}>
                            <Doughnut data={pieData} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:'#94a3b8',font:{size:10} } } } }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* SEGMENTS */}
          {tab === 'segments' && segments.length > 0 && (
            <>
              <div className="kpi-grid" style={{ marginBottom:20 }}>
                <div className="kpi-card" style={{ '--kpi-color':'var(--blue)' }}><div className="kpi-icon">🔧</div><div className="kpi-label">Segments</div><div className="kpi-value" style={{ color:'var(--blue)' }}>{segments.length}</div><div className="kpi-sub">detected in CSV</div></div>
                <div className="kpi-card" style={{ '--kpi-color':'var(--red)' }}><div className="kpi-icon">🚨</div><div className="kpi-label">Critical</div><div className="kpi-value" style={{ color:'var(--red)' }}>{pipeKpis?.criticalSegments||0}</div><div className="kpi-sub">urgent</div></div>
                <div className="kpi-card" style={{ '--kpi-color':'var(--amber)' }}><div className="kpi-icon">⚠️</div><div className="kpi-label">Warning</div><div className="kpi-value" style={{ color:'var(--amber)' }}>{pipeKpis?.warningSegments||0}</div><div className="kpi-sub">monitor</div></div>
                <div className="kpi-card" style={{ '--kpi-color':'var(--green)' }}><div className="kpi-icon">✅</div><div className="kpi-label">Normal</div><div className="kpi-value" style={{ color:'var(--green)' }}>{pipeKpis?.normalSegments||0}</div><div className="kpi-sub">operating normally</div></div>
              </div>
              {segChart && (
                <div className="card" style={{ marginBottom:20 }}>
                  <div className="card-header"><span className="card-title">SEGMENT LEAKAGE RISK SCORES</span></div>
                  <div className="chart-container" style={{ height:260 }}><Bar data={segChart} options={CHART_OPTS} /></div>
                </div>
              )}
              <div className="card">
                <div className="card-header"><span className="card-title">SEGMENT DETAILS FROM CSV</span><span className="badge badge-gray">{segments.length}</span></div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Segment</th><th>Avg Pressure</th><th>Avg Flow</th><th>Avg Loss</th><th>Leakage Score</th><th>Risk Bar</th><th>Status</th><th>Records</th></tr></thead>
                    <tbody>
                      {segments.map((s,i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{s.segment}</td>
                          <td>{s.avgPressure!=null?s.avgPressure.toFixed(2):'—'}</td>
                          <td>{s.avgFlow!=null?s.avgFlow.toFixed(2):'—'}</td>
                          <td style={{ color:s.avgLoss>0?'var(--red)':'var(--text-muted)' }}>{s.avgLoss!=null?s.avgLoss.toFixed(2):'—'}</td>
                          <td style={{ fontWeight:700, color:SEV_COLOR[s.status] }}>{s.leakageScore.toFixed(1)}</td>
                          <td style={{ minWidth:100 }}>
                            <div style={{ height:8, background:'rgba(255,255,255,0.06)', borderRadius:4 }}>
                              <div style={{ width:`${Math.min(100,s.leakageScore)}%`, height:'100%', background:SEV_COLOR[s.status], borderRadius:4 }} />
                            </div>
                          </td>
                          <td><span className={`badge ${SEV_BADGE[s.status]}`}>{s.status}</span></td>
                          <td style={{ color:'var(--text-muted)' }}>{s.recordCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* CATEGORY CHARTS */}
          {tab === 'cats' && catCharts.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">CATEGORICAL COLUMN DISTRIBUTIONS</span><span className="badge badge-gray">{catCharts.length} columns</span></div>
              <div className="grid-2">
                {catCharts.map((cc, i) => (
                  <div key={i}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.04em' }}>{cc.column}</div>
                    <div className="chart-container" style={{ height:200 }}>
                      <Doughnut
                        data={{ labels:cc.labels, datasets:[{ data:cc.values, backgroundColor:PALETTE.map(c=>c+'cc'), borderColor:PALETTE, borderWidth:1 }] }}
                        options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:'#94a3b8',font:{size:10},boxWidth:12 } } } }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ANALYSIS */}
          {tab === 'analysis' && (
            <>
              {zones.length > 0 ? (
                <div className="grid-2" style={{ marginBottom:20 }}>
                  <div className="card">
                    <div className="card-header"><span className="card-title">ANOMALY COUNT BY ZONE</span></div>
                    <div className="chart-container" style={{ height:240 }}>
                      <Doughnut
                        data={{ labels:zones.map(z=>z.zone), datasets:[{ data:zones.map(z=>z.anomalies||0), backgroundColor:zones.map((_,i)=>PALETTE[i%PALETTE.length]+'bb'), borderColor:zones.map((_,i)=>PALETTE[i%PALETTE.length]), borderWidth:2 }] }}
                        options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:'#94a3b8',font:{size:10} } } } }}
                      />
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-header"><span className="card-title">EFFICIENCY RANKING</span></div>
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th>#</th><th>Zone</th><th>Efficiency</th><th>Anomalies</th><th>Status</th></tr></thead>
                        <tbody>
                          {[...zones].sort((a,b)=>(b.efficiency||0)-(a.efficiency||0)).map((z,i) => {
                            const st = zoneStatus(z.efficiency||0);
                            const idx = zones.findIndex(zz=>zz.zone===z.zone);
                            return (
                              <tr key={z.zone}>
                                <td style={{ color:i===0?'var(--amber)':'var(--text-muted)', fontWeight:i===0?700:400 }}>#{i+1}</td>
                                <td>
                                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <span style={{ width:8,height:8,borderRadius:'50%',background:PALETTE[idx%PALETTE.length],display:'inline-block' }} />
                                    <span style={{ color:'var(--text-primary)' }}>{z.zone}</span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <div style={{ width:50,height:6,background:'rgba(255,255,255,0.06)',borderRadius:3 }}>
                                      <div style={{ width:`${z.efficiency||0}%`,height:'100%',background:(z.efficiency||0)>=90?'var(--green)':(z.efficiency||0)>=75?'var(--amber)':'var(--red)',borderRadius:3 }} />
                                    </div>
                                    <span style={{ fontSize:12 }}>{z.efficiency||0}%</span>
                                  </div>
                                </td>
                                <td style={{ color:z.anomalies>0?'var(--amber)':'var(--green)' }}>{z.anomalies}</td>
                                <td><span className={`badge ${SEV_BADGE[st]}`}>{st}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <MissingDataNotice
                  title="Zone column missing — efficiency analysis not available"
                  message="Add a zone/area column to your CSV to see zone efficiency rankings."
                  columns={['zone','area','district','region']}
                />
              )}
              {segments.length > 0 ? (
                <div className="card">
                  <div className="card-header"><span className="card-title">PIPELINE LOSS RANKING (FROM CSV)</span></div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Rank</th><th>Segment</th><th>Leakage Score</th><th>Avg Loss</th><th>Status</th><th>Priority</th></tr></thead>
                      <tbody>
                        {[...segments].sort((a,b)=>b.leakageScore-a.leakageScore).map((s,i) => (
                          <tr key={i}>
                            <td style={{ color:i<3?'var(--red)':'var(--text-muted)', fontWeight:i<3?700:400 }}>#{i+1}</td>
                            <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{s.segment}</td>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:60,height:6,background:'rgba(255,255,255,0.06)',borderRadius:3 }}>
                                  <div style={{ width:`${Math.min(100,s.leakageScore)}%`,height:'100%',background:SEV_COLOR[s.status],borderRadius:3 }} />
                                </div>
                                <span style={{ fontSize:12, color:SEV_COLOR[s.status] }}>{s.leakageScore.toFixed(1)}</span>
                              </div>
                            </td>
                            <td style={{ color:s.avgLoss>0?'var(--red)':'var(--text-muted)' }}>{s.avgLoss!=null?s.avgLoss.toFixed(2):'—'}</td>
                            <td><span className={`badge ${SEV_BADGE[s.status]}`}>{s.status}</span></td>
                            <td style={{ color:i<3?'var(--red)':i<6?'var(--amber)':'var(--green)', fontWeight:i<3?700:400 }}>{i<3?'🔴 High':i<6?'🟡 Medium':'🟢 Low'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <MissingDataNotice
                  title="Pipeline segment column missing — loss ranking not available"
                  message="Add a segment column to your CSV to see pipeline loss rankings."
                  columns={['pipe_segment','segment','pipeline']}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
