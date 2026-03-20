/**
 * PipelineVisualizationPage
 * Reads ONLY from GET /api/predictions/pipeline
 * Builds an interactive SVG network from whatever segments the CSV contains.
 * If the CSV has no pipeline/segment columns, shows clear guidance.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color:'#94a3b8', font:{size:11} } } },
  scales: {
    x:{ grid:{color:'rgba(99,179,237,0.06)'}, ticks:{color:'#64748b',font:{size:10},maxRotation:30} },
    y:{ grid:{color:'rgba(99,179,237,0.06)'}, ticks:{color:'#64748b',font:{size:10}} },
  },
};

const SEV_COLOR = { Critical:'#ef4444', Warning:'#f59e0b', Normal:'#22c55e' };
const SEV_BADGE = { Critical:'badge-red', Warning:'badge-amber', Normal:'badge-green' };

function MissingDataNotice({ title, message, columns }) {
  return (
    <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:10, padding:'16px 20px', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ fontSize:20, flexShrink:0 }}>⚠️</span>
        <div>
          <div style={{ fontWeight:600, color:'#fbbf24', marginBottom:4, fontSize:13 }}>{title}</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>{message}</div>
          {columns && (
            <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
              {columns.map(c => <code key={c} style={{ background:'rgba(245,158,11,0.12)', color:'#fbbf24', padding:'2px 8px', borderRadius:4, fontSize:11 }}>{c}</code>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Layout segments radially around a source node
function radialLayout(segments, W, H) {
  const cx = W / 2, cy = H / 2;
  if (segments.length === 0) return [];
  if (segments.length === 1) return [{ ...segments[0], x: cx, y: cy - 130 }];
  const r = Math.min(W, H) * 0.35;
  return segments.map((seg, i) => {
    const angle = (2 * Math.PI * i / segments.length) - Math.PI / 2;
    return { ...seg, x: Math.round(cx + r * Math.cos(angle)), y: Math.round(cy + r * Math.sin(angle)) };
  });
}

export default function PipelineVisualizationPage() {
  const navigate = useNavigate();
  const [loading,   setLoading]   = useState(true);
  const [pipeline,  setPipeline]  = useState(null);
  const [segments,  setSegments]  = useState([]);
  const [kpis,      setKpis]      = useState({});
  const [noDataset, setNoDataset] = useState(false);
  const [noPipeline,setNoPipeline]= useState(false);
  const [selected,  setSelected]  = useState(null);
  const [filter,    setFilter]    = useState('All');
  const [animated,  setAnimated]  = useState(true);
  const [tab,       setTab]       = useState('viz');

  useEffect(() => {
    api.get('/predictions/pipeline')
      .then(r => {
        const pl = r.data?.pipeline;
        const segs = pl?.segments || [];
        setPipeline(pl);
        setSegments(segs);
        setKpis(pl?.kpis || {});
        setNoPipeline(!pl?.hasPipelineData);
      })
      .catch(err => { if (err?.response?.status === 404) setNoDataset(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-wrapper"><div className="loading-center"><div className="spinner" /><span>Loading pipeline data…</span></div></div>;

  if (noDataset) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">🗜️ Pipeline Network Visualization</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">📤</div>
          <div className="no-data-title">No dataset uploaded yet</div>
          <div className="no-data-sub">Upload a CSV file to begin. Try sample dataset <strong>01_full_featured.csv</strong> or <strong>03_pipeline_crisis.csv</strong> for full pipeline visualization.</div>
          <button className="btn btn-primary" style={{ marginTop:20 }} onClick={() => navigate('/upload')}>📤 Upload CSV Dataset</button>
        </div>
      </div>
    </div>
  );

  const SVG_W = 760, SVG_H = 480;
  const SRC_X = SVG_W / 2, SRC_Y = SVG_H / 2;

  const filtered   = filter === 'All' ? segments : segments.filter(s => s.status === filter);
  const nodes      = radialLayout(filtered, SVG_W, SVG_H);
  const maxFlow    = Math.max(...segments.map(s => s.avgFlow || 0), 1);
  const maxLScore  = Math.max(...segments.map(s => s.leakageScore || 0), 1);

  const critCount = segments.filter(s => s.status === 'Critical').length;
  const warnCount = segments.filter(s => s.status === 'Warning').length;
  const normCount = segments.filter(s => s.status === 'Normal').length;

  const barData = segments.length > 0 ? {
    labels: segments.map(s => s.segment),
    datasets: [{
      label: 'Leakage Score',
      data: segments.map(s => s.leakageScore),
      backgroundColor: segments.map(s => s.status==='Critical'?'rgba(239,68,68,0.7)':s.status==='Warning'?'rgba(245,158,11,0.7)':'rgba(34,197,94,0.5)'),
      borderColor:     segments.map(s => SEV_COLOR[s.status]),
      borderWidth:1, borderRadius:4,
    }],
  } : null;

  const TABS = [
    { id:'viz',   label:'🗜️ Network Map' },
    { id:'table', label:'📋 Segment Table' },
    ...(barData ? [{ id:'chart', label:'📊 Risk Chart' }] : []),
  ];

  return (
    <div className="page-wrapper">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">🗜️ Pipeline Network Visualization</h1>
          <p className="page-subtitle">Interactive map built from your CSV — {segments.length > 0 ? `${segments.length} segments detected` : 'no segments found'}</p>
        </div>
        {segments.length > 0 && (
          <button className={`tab-btn${animated?' active':''}`} style={{ fontSize:12 }} onClick={() => setAnimated(a=>!a)}>
            {animated ? '⏸ Pause Flow' : '▶ Animate Flow'}
          </button>
        )}
      </div>

      {noPipeline && (
        <MissingDataNotice
          title="Pipeline / segment columns not detected in your CSV"
          message="This visualization requires a segment identifier column plus at least one of: pressure, flow_rate, or leakage columns. Try uploading sample dataset 01_full_featured.csv or 03_pipeline_crisis.csv."
          columns={['pipe_segment','segment','pipeline','pressure','flow_rate','leakage','loss']}
        />
      )}

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(5,1fr)' }}>
        <div className="kpi-card" style={{ '--kpi-color':'var(--blue)' }}><div className="kpi-icon">🔧</div><div className="kpi-label">Segments</div><div className="kpi-value" style={{ color:'var(--blue)' }}>{segments.length||'—'}</div><div className="kpi-sub">from CSV</div></div>
        <div className="kpi-card" style={{ '--kpi-color':critCount>0?'var(--red)':'var(--green)' }}><div className="kpi-icon">🚨</div><div className="kpi-label">Critical</div><div className="kpi-value" style={{ color:critCount>0?'var(--red)':'var(--green)' }}>{segments.length?critCount:'—'}</div><div className="kpi-sub">urgent attention</div></div>
        <div className="kpi-card" style={{ '--kpi-color':'var(--amber)' }}><div className="kpi-icon">⚠️</div><div className="kpi-label">Warning</div><div className="kpi-value" style={{ color:'var(--amber)' }}>{segments.length?warnCount:'—'}</div><div className="kpi-sub">monitor</div></div>
        <div className="kpi-card" style={{ '--kpi-color':'var(--green)' }}><div className="kpi-icon">✅</div><div className="kpi-label">Normal</div><div className="kpi-value" style={{ color:'var(--green)' }}>{segments.length?normCount:'—'}</div><div className="kpi-sub">ok</div></div>
        <div className="kpi-card" style={{ '--kpi-color':kpis.nrwPercent>20?'var(--red)':'var(--cyan)' }}><div className="kpi-icon">📉</div><div className="kpi-label">NRW %</div><div className="kpi-value" style={{ color:kpis.nrwPercent>20?'var(--red)':'var(--cyan)' }}>{kpis.nrwPercent!=null?`${kpis.nrwPercent}%`:'—'}</div><div className="kpi-sub">non-revenue water</div></div>
      </div>

      {segments.length === 0 && (
        <div className="card" style={{ marginTop:8 }}>
          <div className="no-data-state">
            <div className="no-data-icon">🗜️</div>
            <div className="no-data-title">No pipeline segments to visualize</div>
            <div className="no-data-sub">Your CSV does not contain pipeline segment data. See the notice above for required columns, or try sample dataset <b>01_full_featured.csv</b>.</div>
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <>
          <div className="tabs">{TABS.map(tb=><button key={tb.id} className={`tab-btn${tab===tb.id?' active':''}`} onClick={()=>setTab(tb.id)}>{tb.label}</button>)}</div>

          {/* NETWORK MAP */}
          {tab === 'viz' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                {/* Filter bar */}
                <div style={{ padding:'11px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span className="card-title" style={{ marginRight:6 }}>FILTER</span>
                  {['All','Critical','Warning','Normal'].map(s => (
                    <button key={s} className={`tab-btn${filter===s?' active':''}`}
                      style={{ fontSize:11, padding:'3px 12px', borderLeft:s!=='All'?`3px solid ${SEV_COLOR[s]||'transparent'}`:'' }}
                      onClick={() => { setFilter(s); setSelected(null); }}>
                      {s} {s!=='All'?`(${segments.filter(sg=>sg.status===s).length})`:''}
                    </button>
                  ))}
                  <div style={{ marginLeft:'auto', display:'flex', gap:14, fontSize:11, color:'var(--text-muted)' }}>
                    {[['#ef4444','Critical'],['#f59e0b','Warning'],['#22c55e','Normal']].map(([c,l])=>(
                      <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ width:20, height:4, background:c, borderRadius:2 }} />{l}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SVG */}
                <div style={{ background:'#080d1a', padding:8 }}>
                  <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width:'100%', cursor:'default' }} onClick={() => setSelected(null)}>
                    <defs>
                      <filter id="pvGlow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                      {/* Path defs for animation */}
                      {nodes.map(n => (
                        <path key={`pd-${n.segment}`}
                          id={`pvpath-${n.segment.replace(/[\s\-\.]/g,'_')}`}
                          d={`M ${SRC_X} ${SRC_Y} L ${n.x} ${n.y}`} />
                      ))}
                    </defs>

                    {/* Subtle grid */}
                    {[100,200,300,400].map(y => <line key={`gy${y}`} x1={0} y1={y} x2={SVG_W} y2={y} stroke="rgba(99,179,237,0.04)" strokeWidth={1} />)}
                    {[100,200,300,400,500,600,700].map(x => <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={SVG_H} stroke="rgba(99,179,237,0.04)" strokeWidth={1} />)}

                    {/* Pipeline lines */}
                    {nodes.map(n => {
                      const color  = SEV_COLOR[n.status];
                      const thick  = 3 + (n.avgFlow||0) / maxFlow * 10;
                      const isSel  = selected?.segment === n.segment;
                      const pid    = `pvpath-${n.segment.replace(/[\s\-\.]/g,'_')}`;
                      const dur    = Math.max(1.5, 3.5 - (n.avgFlow||0) / maxFlow * 2);
                      return (
                        <g key={`line-${n.segment}`}>
                          {isSel && <line x1={SRC_X} y1={SRC_Y} x2={n.x} y2={n.y} stroke={color} strokeWidth={thick+8} opacity={0.2} filter="url(#pvGlow)" />}
                          <line x1={SRC_X} y1={SRC_Y} x2={n.x} y2={n.y}
                            stroke={color} strokeWidth={isSel?thick+3:thick} opacity={0.82} strokeLinecap="round"
                            strokeDasharray={n.status==='Critical'?'8,4':undefined}
                            style={{ cursor:'pointer', transition:'stroke-width 0.15s' }}
                            onClick={e => { e.stopPropagation(); setSelected(n); }} />
                          {/* Animated particle */}
                          {animated && (
                            <circle r="3" fill={color} opacity="0.9">
                              <animateMotion dur={`${dur.toFixed(1)}s`} repeatCount="indefinite">
                                <mpath href={`#${pid}`} />
                              </animateMotion>
                            </circle>
                          )}
                          {/* Critical pulse */}
                          {n.status === 'Critical' && (
                            <circle cx={n.x} cy={n.y} r={9} fill="none" stroke="#ef4444" strokeWidth={2}>
                              <animate attributeName="r" values="9;22;9" dur="2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
                            </circle>
                          )}
                        </g>
                      );
                    })}

                    {/* Source node */}
                    <g>
                      <circle cx={SRC_X} cy={SRC_Y} r={34} fill="rgba(6,182,212,0.12)" stroke="#06b6d4" strokeWidth={2} />
                      <text x={SRC_X} y={SRC_Y-4} textAnchor="middle" fontSize={16}>🏭</text>
                      <text x={SRC_X} y={SRC_Y+14} textAnchor="middle" fill="#06b6d4" fontSize={9} fontWeight={700}>SOURCE</text>
                      {animated && (
                        <circle cx={SRC_X} cy={SRC_Y} r={34} fill="none" stroke="#06b6d4" strokeWidth={1.5} opacity={0.3}>
                          <animate attributeName="r" values="34;50;34" dur="3s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
                        </circle>
                      )}
                    </g>

                    {/* Segment nodes */}
                    {nodes.map(n => {
                      const color = SEV_COLOR[n.status];
                      const isSel = selected?.segment === n.segment;
                      const lbl   = n.segment.length > 11 ? n.segment.slice(0,10)+'…' : n.segment;
                      return (
                        <g key={`node-${n.segment}`} style={{ cursor:'pointer' }} onClick={e => { e.stopPropagation(); setSelected(n); }}>
                          {isSel && <circle cx={n.x} cy={n.y} r={30} fill={color} opacity={0.12} filter="url(#pvGlow)" />}
                          <circle cx={n.x} cy={n.y} r={isSel?26:22} fill={`${color}20`} stroke={color} strokeWidth={isSel?3:2} style={{ transition:'r 0.15s' }} />
                          <text x={n.x} y={n.y+4} textAnchor="middle" fill={color} fontSize={9} fontWeight={700}>{lbl}</text>
                          <text x={n.x} y={n.y+36} textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize={8}>
                            {n.leakageScore.toFixed(0)} risk
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Map legend */}
                <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:16, fontSize:11, color:'var(--text-muted)', flexWrap:'wrap' }}>
                  <span>Line width = avg flow</span>
                  <span>Moving dots = flow direction</span>
                  <span>Pulsing ring = critical leak</span>
                  <span>Dashed = critical segment</span>
                </div>
              </div>

              {/* Side panel */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {selected ? (
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">SEGMENT DETAIL</span>
                      <span className={`badge ${SEV_BADGE[selected.status]}`}>{selected.status}</span>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:12 }}>{selected.segment}</div>
                    {[
                      { label:'Avg Pressure', value: selected.avgPressure!=null?selected.avgPressure.toFixed(2):'Not in CSV', color:'var(--cyan)' },
                      { label:'Avg Flow',      value: selected.avgFlow!=null?selected.avgFlow.toFixed(2):'Not in CSV',         color:'var(--blue)' },
                      { label:'Avg Loss',      value: selected.avgLoss!=null?selected.avgLoss.toFixed(2):'Not in CSV',         color: selected.avgLoss>0?'var(--red)':'var(--text-muted)' },
                      { label:'Leakage Score', value: selected.leakageScore.toFixed(1),                                        color: SEV_COLOR[selected.status] },
                      { label:'Records',        value: selected.recordCount,                                                    color:'var(--text-secondary)' },
                    ].map(r => (
                      <div key={r.label} className="stat-row">
                        <span className="stat-label">{r.label}</span>
                        <span className="stat-value" style={{ color:r.color, fontSize:12 }}>{r.value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop:12 }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Leakage Risk</div>
                      <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:4, height:8 }}>
                        <div style={{ width:`${Math.min(100,selected.leakageScore/maxLScore*100)}%`, height:'100%', background:SEV_COLOR[selected.status], borderRadius:4 }} />
                      </div>
                    </div>
                    {selected.status === 'Critical' && <div className="alert alert-warning" style={{ marginTop:12, fontSize:11 }}>⚠️ Critical — immediate inspection required.</div>}
                  </div>
                ) : (
                  <div className="card">
                    <div className="card-header"><span className="card-title">HOW TO READ</span></div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.9 }}>
                      <p>🖱️ <b style={{ color:'var(--text-secondary)' }}>Click</b> any segment node for details.</p>
                      <p>🎨 Line color = status.</p>
                      <p>📏 Line width = relative flow.</p>
                      <p>🔴 Pulsing ring = critical leak.</p>
                      <p>⚡ Moving dots = flow direction.</p>
                      <p style={{ marginTop:8, fontSize:11 }}>All data from your uploaded CSV. Columns not present in your file show "Not in CSV".</p>
                    </div>
                  </div>
                )}
                {/* System summary */}
                <div className="card">
                  <div className="card-header"><span className="card-title">SYSTEM SUMMARY</span></div>
                  {[
                    { label:'Pressure Column', value:pipeline?.pressureCol||'Not detected' },
                    { label:'Flow Column',      value:pipeline?.flowCol||'Not detected' },
                    { label:'Pressure Trend',   value:pipeline?.pressureTrend||'—' },
                    { label:'Avg Pressure',     value:kpis.avgSystemPressure!=null?kpis.avgSystemPressure.toFixed(2):'—' },
                    { label:'Avg Flow',          value:kpis.avgSystemFlow!=null?kpis.avgSystemFlow.toFixed(2):'—' },
                    { label:'NRW %',             value:kpis.nrwPercent!=null?`${kpis.nrwPercent}%`:'—' },
                  ].map(r => (
                    <div key={r.label} className="stat-row">
                      <span className="stat-label">{r.label}</span>
                      <span className="stat-value" style={{ fontSize:12, color: r.value==='Not detected'?'var(--text-muted)':'var(--text-primary)' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                {/* Segment list */}
                <div className="card" style={{ flex:1 }}>
                  <div className="card-header"><span className="card-title">SEGMENTS</span><span className="badge badge-gray">{filtered.length}</span></div>
                  <div style={{ overflowY:'auto', maxHeight:260 }}>
                    {filtered.map(s => (
                      <div key={s.segment} onClick={() => setSelected(nodes.find(n=>n.segment===s.segment)||s)}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:6, marginBottom:3, cursor:'pointer',
                          background:selected?.segment===s.segment?'rgba(99,179,237,0.08)':'rgba(255,255,255,0.02)',
                          border:selected?.segment===s.segment?'1px solid rgba(99,179,237,0.2)':'1px solid transparent' }}>
                        <div style={{ width:5,height:5,borderRadius:'50%',background:SEV_COLOR[s.status],flexShrink:0 }} />
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:12,color:'var(--text-primary)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{s.segment}</div>
                          <div style={{ fontSize:10,color:'var(--text-muted)' }}>Score:{s.leakageScore.toFixed(1)} · {s.recordCount} records</div>
                        </div>
                        <span className={`badge ${SEV_BADGE[s.status]}`} style={{ fontSize:9 }}>{s.status}</span>
                      </div>
                    ))}
                    {filtered.length === 0 && <div style={{ padding:'16px', color:'var(--text-muted)', fontSize:12, textAlign:'center' }}>No segments match filter</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABLE */}
          {tab === 'table' && (
            <div className="card">
              <div className="card-header"><span className="card-title">ALL SEGMENTS FROM CSV</span><span className="badge badge-gray">{segments.length}</span></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Segment</th><th>Avg Pressure</th><th>Avg Flow</th><th>Avg Loss</th><th>Leakage Score</th><th>Risk Bar</th><th>Status</th><th>Records</th></tr></thead>
                  <tbody>
                    {segments.map((s,i) => (
                      <tr key={i} style={{ cursor:'pointer' }} onClick={() => { setTab('viz'); setSelected(nodes.find(n=>n.segment===s.segment)||s); }}>
                        <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{s.segment}</td>
                        <td>{s.avgPressure!=null?s.avgPressure.toFixed(2):<span style={{ color:'var(--text-muted)',fontSize:11 }}>not in CSV</span>}</td>
                        <td>{s.avgFlow!=null?s.avgFlow.toFixed(2):<span style={{ color:'var(--text-muted)',fontSize:11 }}>not in CSV</span>}</td>
                        <td style={{ color:s.avgLoss>0?'var(--red)':'var(--text-muted)' }}>{s.avgLoss!=null?s.avgLoss.toFixed(2):<span style={{ fontSize:11 }}>not in CSV</span>}</td>
                        <td style={{ fontWeight:700, color:SEV_COLOR[s.status] }}>{s.leakageScore.toFixed(1)}</td>
                        <td style={{ minWidth:100 }}>
                          <div style={{ height:8, background:'rgba(255,255,255,0.06)', borderRadius:4 }}>
                            <div style={{ width:`${Math.min(100,s.leakageScore/maxLScore*100)}%`, height:'100%', background:SEV_COLOR[s.status], borderRadius:4 }} />
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
          )}

          {/* CHART */}
          {tab === 'chart' && barData && (
            <div className="card">
              <div className="card-header"><span className="card-title">LEAKAGE RISK SCORES BY SEGMENT</span></div>
              <div className="chart-container" style={{ height:320 }}><Bar data={barData} options={CHART_OPTS} /></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
