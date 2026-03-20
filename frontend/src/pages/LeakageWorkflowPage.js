/**
 * LeakageWorkflowPage
 * All leakage data sourced exclusively from:
 *   GET /api/predictions/pipeline  → segments with leakage scores
 *   GET /api/predictions/zones     → zones with efficiency scores
 * Leakage records are derived from CSV data — nothing hardcoded.
 * Repair tasks are managed in component state (user-created).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const CHART_OPTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{ labels:{ color:'#94a3b8',font:{size:11} } } },
  scales:{
    x:{ grid:{color:'rgba(99,179,237,0.06)'}, ticks:{color:'#64748b',font:{size:10},maxRotation:30} },
    y:{ grid:{color:'rgba(99,179,237,0.06)'}, ticks:{color:'#64748b',font:{size:10}} },
  },
};

const SEV_COLOR = { Critical:'var(--red)', Warning:'var(--amber)', Normal:'var(--green)' };
const SEV_BADGE = { Critical:'badge-red', Warning:'badge-amber', Normal:'badge-green' };
const PRIO_COLOR = { High:'var(--red)', Medium:'var(--amber)', Low:'var(--green)' };

const STATUS_LIST  = ['Pending','In Progress','Completed','On Hold'];
const PRIORITY_LIST= ['High','Medium','Low'];
const TEAMS        = ['Team Alpha','Team Beta','Team Gamma','Team Delta','Team Epsilon'];

function si(s) { return s==='Pending'?'🕐':s==='In Progress'?'🔄':s==='Completed'?'✅':'⏸'; }

function MissingDataNotice({ title, message, columns }) {
  return (
    <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:10, padding:'16px 20px', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ fontSize:20, flexShrink:0 }}>⚠️</span>
        <div>
          <div style={{ fontWeight:600, color:'#fbbf24', marginBottom:4, fontSize:13 }}>{title}</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>{message}</div>
          {columns && <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>{columns.map(c=><code key={c} style={{ background:'rgba(245,158,11,0.12)',color:'#fbbf24',padding:'2px 8px',borderRadius:4,fontSize:11 }}>{c}</code>)}</div>}
        </div>
      </div>
    </div>
  );
}

// Build leakage records purely from CSV-derived data
function buildLeakageRecords(segments, zones) {
  const records = [];
  // From pipeline segments — include Warning + Critical
  segments.forEach((seg, i) => {
    if (seg.status === 'Normal' && seg.leakageScore < 15) return;
    records.push({
      id: `SEG-${String(i+1).padStart(3,'0')}`,
      source: 'pipeline',
      name: seg.segment,
      zone: '—',
      severity: seg.status,
      leakageScore: seg.leakageScore,
      avgLoss: seg.avgLoss,
      avgPressure: seg.avgPressure,
      avgFlow: seg.avgFlow,
      recordCount: seg.recordCount,
    });
  });
  // From zones with low efficiency
  zones.forEach((z, i) => {
    if ((z.efficiency||100) >= 85) return;
    const severity = (z.efficiency||100) < 70 ? 'Critical' : 'Warning';
    records.push({
      id: `ZON-${String(i+1).padStart(3,'0')}`,
      source: 'zone',
      name: z.zone,
      zone: z.zone,
      severity,
      leakageScore: parseFloat((100 - (z.efficiency||100)).toFixed(1)),
      avgLoss: null,
      avgPressure: null,
      avgFlow: null,
      recordCount: z.count,
    });
  });
  return records.sort((a,b) => b.leakageScore - a.leakageScore);
}

export default function LeakageWorkflowPage() {
  const navigate    = useNavigate();
  const [loading,   setLoading]   = useState(true);
  const [leakages,  setLeakages]  = useState([]);
  const [tasks,     setTasks]     = useState([]);
  const [noDataset, setNoDataset] = useState(false);
  const [noLeakage, setNoLeakage] = useState(false);
  const [missingPipeline,setMissingPipeline] = useState(false);
  const [missingZone,    setMissingZone]     = useState(false);
  const [tab,       setTab]       = useState('leakages');
  const [filterSev, setFilterSev] = useState('All');
  const [filterStat,setFilterStat]= useState('All');
  const [newTask,   setNewTask]   = useState(null);
  const [editTask,  setEditTask]  = useState(null);
  const [taskForm,  setTaskForm]  = useState({});
  const [detailLeak,setDetailLeak]= useState(null);

  useEffect(() => {
    Promise.all([api.get('/predictions/pipeline'), api.get('/predictions/zones')])
      .then(([pr, zr]) => {
        const segs  = pr.data?.pipeline?.segments || [];
        const zones = zr.data?.zoneDistribution   || [];
        setMissingPipeline(!pr.data?.pipeline?.hasPipelineData);
        setMissingZone(zones.length === 0);
        const records = buildLeakageRecords(segs, zones);
        setLeakages(records);
        if (records.length === 0) setNoLeakage(true);
      })
      .catch(err => { if (err?.response?.status === 404) setNoDataset(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-wrapper"><div className="loading-center"><div className="spinner" /><span>Analysing leakage data…</span></div></div>;

  if (noDataset) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">🔍 Leakage Detection & Resolution</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">📤</div>
          <div className="no-data-title">No dataset uploaded yet</div>
          <div className="no-data-sub">Upload a CSV file to begin. For leakage detection, include pipeline segment columns (<code>segment</code>, <code>pressure</code>, <code>leakage</code>) or zone columns (<code>zone</code>, <code>consumption</code>).</div>
          <button className="btn btn-primary" style={{ marginTop:20 }} onClick={()=>navigate('/upload')}>📤 Upload CSV Dataset</button>
        </div>
      </div>
    </div>
  );

  // ── Metrics ──────────────────────────────────────────────────
  const critCount  = leakages.filter(l=>l.severity==='Critical').length;
  const warnCount  = leakages.filter(l=>l.severity==='Warning').length;
  const pendCount  = tasks.filter(t=>t.status==='Pending').length;
  const ipCount    = tasks.filter(t=>t.status==='In Progress').length;
  const doneCount  = tasks.filter(t=>t.status==='Completed').length;

  const filtered   = leakages.filter(l => filterSev==='All' || l.severity===filterSev);
  const filteredTasks = tasks.filter(t => filterStat==='All' || t.status===filterStat);

  // ── Task CRUD ─────────────────────────────────────────────────
  const openNewTask = (leak) => {
    setNewTask(leak);
    setTaskForm({ title:`Repair – ${leak.name}`, team:TEAMS[0], assigned:'', status:'Pending',
      priority:leak.severity==='Critical'?'High':'Medium', due:'', notes:'' });
  };
  const createTask = () => {
    setTasks(prev=>[...prev,{ id:`TK${Date.now()}`, leakageId:newTask.id, ...taskForm, created:new Date().toISOString().slice(0,10) }]);
    setNewTask(null);
  };
  const openEditTask  = (t) => { setEditTask(t); setTaskForm({...t}); };
  const saveTask      = () => { setTasks(prev=>prev.map(t=>t.id===editTask.id?{...t,...taskForm}:t)); setEditTask(null); };
  const deleteTask    = (id) => setTasks(prev=>prev.filter(t=>t.id!==id));
  const advanceStatus = (id,status) => setTasks(prev=>prev.map(t=>t.id===id?{...t,status}:t));

  // ── Charts ────────────────────────────────────────────────────
  const barData = leakages.length > 0 ? {
    labels: leakages.map(l=>l.id),
    datasets:[{
      label:'Leakage Score',
      data: leakages.map(l=>l.leakageScore),
      backgroundColor: leakages.map(l=>l.severity==='Critical'?'rgba(239,68,68,0.7)':l.severity==='Warning'?'rgba(245,158,11,0.7)':'rgba(34,197,94,0.5)'),
      borderColor:     leakages.map(l=>l.severity==='Critical'?'#ef4444':l.severity==='Warning'?'#f59e0b':'#22c55e'),
      borderWidth:1, borderRadius:4,
    }],
  } : null;

  const taskDough = tasks.length > 0 ? {
    labels:['Pending','In Progress','Completed','On Hold'],
    datasets:[{ data:[pendCount,ipCount,doneCount,tasks.filter(t=>t.status==='On Hold').length],
      backgroundColor:['rgba(245,158,11,0.7)','rgba(6,182,212,0.7)','rgba(34,197,94,0.7)','rgba(100,116,139,0.5)'],
      borderColor:['#f59e0b','#06b6d4','#22c55e','#64748b'], borderWidth:1 }],
  } : null;

  const TABS = [
    { id:'leakages',  label:`🚨 Detected (${leakages.length})` },
    { id:'workflow',  label:`🔄 Workflow (${tasks.length})` },
    { id:'analytics', label:'📊 Analytics' },
  ];

  // ── Field definitions for task modals ────────────────────────
  const textFields   = [{key:'title',label:'Task Title',type:'text'},{key:'assigned',label:'Assignee',type:'text'},{key:'due',label:'Due Date',type:'date'}];
  const selectFields = [{key:'team',label:'Team',opts:TEAMS},{key:'priority',label:'Priority',opts:PRIORITY_LIST},{key:'status',label:'Status',opts:STATUS_LIST}];

  const TaskModal = ({ title, onSave, onClose }) => (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div className="card" style={{ width:500,padding:24,maxHeight:'90vh',overflowY:'auto' }}>
        <h3 style={{ fontSize:15,color:'var(--text-primary)',marginBottom:16 }}>{title}</h3>
        {textFields.map(f=>(
          <div key={f.key} style={{ marginBottom:12 }}>
            <label style={{ fontSize:12,color:'var(--text-secondary)',display:'block',marginBottom:4 }}>{f.label}</label>
            <input className="form-input" type={f.type} value={taskForm[f.key]||''} onChange={e=>setTaskForm(fm=>({...fm,[f.key]:e.target.value}))} style={{ width:'100%' }} />
          </div>
        ))}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12,color:'var(--text-secondary)',display:'block',marginBottom:4 }}>Notes</label>
          <textarea className="form-input" rows={3} value={taskForm.notes||''} onChange={e=>setTaskForm(fm=>({...fm,notes:e.target.value}))} style={{ width:'100%',resize:'vertical' }} />
        </div>
        {selectFields.map(f=>(
          <div key={f.key} style={{ marginBottom:12 }}>
            <label style={{ fontSize:12,color:'var(--text-secondary)',display:'block',marginBottom:4 }}>{f.label}</label>
            <select className="form-input" value={taskForm[f.key]||''} onChange={e=>setTaskForm(fm=>({...fm,[f.key]:e.target.value}))} style={{ width:'100%',background:'var(--bg-secondary)',color:'var(--text-primary)' }}>
              {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:16 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">🔍 Leakage Detection & Resolution</h1>
        <p className="page-subtitle">Auto-detected from your CSV — all leakage records are derived exclusively from uploaded data</p>
      </div>

      {/* Data-completeness notices */}
      {missingPipeline && (
        <MissingDataNotice
          title="Pipeline segment columns not in your CSV — segment-level detection unavailable"
          message="For pipeline leakage detection, add these columns:"
          columns={['pipe_segment','segment','pressure','flow_rate','leakage','loss']}
        />
      )}
      {missingZone && (
        <MissingDataNotice
          title="Zone column not in your CSV — zone-level detection unavailable"
          message="For zone-level leakage detection, add a zone identifier column:"
          columns={['zone','area','district','region']}
        />
      )}

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(6,1fr)' }}>
        <div className="kpi-card" style={{ '--kpi-color':'var(--red)' }}><div className="kpi-icon">🚨</div><div className="kpi-label">Critical</div><div className="kpi-value" style={{ color:'var(--red)' }}>{critCount||'—'}</div><div className="kpi-sub">from CSV</div></div>
        <div className="kpi-card" style={{ '--kpi-color':'var(--amber)' }}><div className="kpi-icon">⚠️</div><div className="kpi-label">Warning</div><div className="kpi-value" style={{ color:'var(--amber)' }}>{warnCount||'—'}</div><div className="kpi-sub">from CSV</div></div>
        <div className="kpi-card" style={{ '--kpi-color':'var(--blue)' }}><div className="kpi-icon">📋</div><div className="kpi-label">Tasks</div><div className="kpi-value" style={{ color:'var(--blue)' }}>{tasks.length}</div><div className="kpi-sub">created</div></div>
        <div className="kpi-card" style={{ '--kpi-color':'var(--amber)' }}><div className="kpi-icon">🕐</div><div className="kpi-label">Pending</div><div className="kpi-value" style={{ color:'var(--amber)' }}>{pendCount}</div><div className="kpi-sub">awaiting</div></div>
        <div className="kpi-card" style={{ '--kpi-color':'var(--cyan)' }}><div className="kpi-icon">🔄</div><div className="kpi-label">In Progress</div><div className="kpi-value" style={{ color:'var(--cyan)' }}>{ipCount}</div><div className="kpi-sub">active</div></div>
        <div className="kpi-card" style={{ '--kpi-color':'var(--green)' }}><div className="kpi-icon">✅</div><div className="kpi-label">Completed</div><div className="kpi-value" style={{ color:'var(--green)' }}>{doneCount}</div><div className="kpi-sub">resolved</div></div>
      </div>

      <div className="tabs">{TABS.map(tb=><button key={tb.id} className={`tab-btn${tab===tb.id?' active':''}`} onClick={()=>setTab(tb.id)}>{tb.label}</button>)}</div>

      {/* LEAKAGES */}
      {tab === 'leakages' && (
        <>
          <div style={{ display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center' }}>
            <span style={{ fontSize:12,color:'var(--text-muted)' }}>Severity:</span>
            {['All','Critical','Warning','Normal'].map(s=>(
              <button key={s} className={`tab-btn${filterSev===s?' active':''}`}
                style={{ fontSize:12,borderLeft:s!=='All'?`3px solid ${s==='Critical'?'#ef4444':s==='Warning'?'#f59e0b':'#22c55e'}`:'' }}
                onClick={()=>setFilterSev(s)}>{s}</button>
            ))}
          </div>

          {noLeakage ? (
            <div className="card">
              <div className="no-data-state">
                <div className="no-data-icon">✅</div>
                <div className="no-data-title">No leakage issues detected in your CSV</div>
                <div className="no-data-sub">All pipeline segments and zones in your dataset appear to be within normal operating parameters. To test leakage detection, try uploading <b>03_pipeline_crisis.csv</b> or <b>01_full_featured.csv</b>.</div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <span className="card-title">AUTO-DETECTED LEAKAGE POINTS FROM CSV</span>
                <span className="badge badge-gray">{filtered.length} records</span>
              </div>
              <div className="alert alert-info" style={{ marginBottom:16 }}>
                Records are auto-detected from pipeline segments (leakage score above threshold) and zones (efficiency below 85%). Source column shown for each record.
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>ID</th><th>Source</th><th>Name</th><th>Severity</th><th>Leakage Score</th><th>Avg Loss</th><th>Records</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => {
                      const hasTask = tasks.some(t=>t.leakageId===l.id);
                      return (
                        <tr key={l.id}>
                          <td style={{ fontFamily:'monospace',fontSize:11,color:'var(--text-muted)' }}>{l.id}</td>
                          <td>
                            <span className={`badge ${l.source==='pipeline'?'badge-cyan':'badge-purple'}`} style={{ fontSize:9 }}>
                              {l.source==='pipeline'?'🔧 Pipeline':'🏙️ Zone'}
                            </span>
                          </td>
                          <td style={{ fontWeight:600,color:'var(--text-primary)' }}>{l.name}</td>
                          <td><span className={`badge ${SEV_BADGE[l.severity]}`}>{l.severity}</span></td>
                          <td>
                            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                              <div style={{ width:50,height:6,background:'rgba(255,255,255,0.06)',borderRadius:3 }}>
                                <div style={{ width:`${Math.min(100,l.leakageScore)}%`,height:'100%',background:SEV_COLOR[l.severity],borderRadius:3 }} />
                              </div>
                              <span style={{ fontSize:12,color:SEV_COLOR[l.severity] }}>{l.leakageScore.toFixed(1)}</span>
                            </div>
                          </td>
                          <td style={{ color:l.avgLoss>0?'var(--red)':'var(--text-muted)' }}>
                            {l.avgLoss!=null?l.avgLoss.toFixed(2):<span style={{ fontSize:11 }}>not in CSV</span>}
                          </td>
                          <td style={{ color:'var(--text-muted)' }}>{l.recordCount?.toLocaleString()||'—'}</td>
                          <td>
                            <div style={{ display:'flex',gap:6 }}>
                              <button className="btn btn-sm" style={{ fontSize:11 }} onClick={()=>setDetailLeak(l)}>Details</button>
                              {!hasTask
                                ? <button className="btn btn-primary btn-sm" style={{ fontSize:11 }} onClick={()=>openNewTask(l)}>＋ Assign</button>
                                : <span style={{ fontSize:11,color:'var(--green)',padding:'3px 6px' }}>✓ Assigned</span>
                              }
                            </div>
                          </td>
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

      {/* WORKFLOW / KANBAN */}
      {tab === 'workflow' && (
        <>
          <div style={{ display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center' }}>
            <span style={{ fontSize:12,color:'var(--text-muted)' }}>Status:</span>
            {['All',...STATUS_LIST].map(s=>(
              <button key={s} className={`tab-btn${filterStat===s?' active':''}`} style={{ fontSize:12 }} onClick={()=>setFilterStat(s)}>
                {si(s)} {s}
              </button>
            ))}
          </div>
          {tasks.length === 0 ? (
            <div className="card">
              <div className="no-data-state" style={{ padding:'40px 20px' }}>
                <div className="no-data-icon">📋</div>
                <div className="no-data-title">No repair tasks yet</div>
                <div className="no-data-sub">Go to the Detected tab and click <b>Assign</b> on any leakage record to create a repair task.</div>
              </div>
            </div>
          ) : (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16 }}>
              {STATUS_LIST.map(status => {
                const col = filteredTasks.filter(t=>t.status===status);
                return (
                  <div key={status}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:10 }}>
                      <span>{si(status)}</span>
                      <span style={{ fontSize:12,fontWeight:600,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'.05em' }}>{status}</span>
                      <span className="badge badge-gray" style={{ marginLeft:'auto' }}>{tasks.filter(t=>t.status===status).length}</span>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                      {col.map(task => {
                        const leak = leakages.find(l=>l.id===task.leakageId);
                        return (
                          <div key={task.id} className="card" style={{ padding:14,borderLeft:`3px solid ${PRIO_COLOR[task.priority]||'var(--border)'}` }}>
                            <div style={{ fontSize:12,fontWeight:600,color:'var(--text-primary)',marginBottom:6,lineHeight:1.4 }}>{task.title}</div>
                            {leak && <div style={{ fontSize:10,color:'var(--text-muted)',marginBottom:6 }}>📍 {leak.name} · {leak.source}</div>}
                            <div style={{ display:'flex',gap:4,marginBottom:8,flexWrap:'wrap' }}>
                              <span className={`badge ${task.priority==='High'?'badge-red':task.priority==='Medium'?'badge-amber':'badge-green'}`} style={{ fontSize:9 }}>{task.priority}</span>
                              {leak && <span className={`badge ${SEV_BADGE[leak.severity]}`} style={{ fontSize:9 }}>{leak.severity}</span>}
                            </div>
                            <div style={{ fontSize:11,color:'var(--text-secondary)',marginBottom:2 }}>👤 {task.assigned||'Unassigned'}</div>
                            <div style={{ fontSize:11,color:'var(--text-secondary)',marginBottom:2 }}>🏢 {task.team}</div>
                            {task.due && <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:6 }}>📅 Due: {task.due}</div>}
                            {task.notes && <div style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.03)',padding:'6px 8px',borderRadius:4,marginBottom:8,lineHeight:1.5 }}>{task.notes}</div>}
                            <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
                              <button className="btn btn-sm" style={{ fontSize:10,padding:'2px 8px' }} onClick={()=>openEditTask(task)}>Edit</button>
                              {status!=='Completed' && <button className="btn btn-sm" style={{ fontSize:10,padding:'2px 8px',color:'var(--green)',borderColor:'rgba(34,197,94,0.3)' }} onClick={()=>advanceStatus(task.id,'Completed')}>✓ Done</button>}
                              {status!=='In Progress'&&status!=='Completed' && <button className="btn btn-sm" style={{ fontSize:10,padding:'2px 8px',color:'var(--cyan)',borderColor:'rgba(6,182,212,0.3)' }} onClick={()=>advanceStatus(task.id,'In Progress')}>▶ Start</button>}
                              <button className="btn btn-sm" style={{ fontSize:10,padding:'2px 8px',color:'var(--red)',borderColor:'rgba(239,68,68,0.3)' }} onClick={()=>deleteTask(task.id)}>🗑️</button>
                            </div>
                          </div>
                        );
                      })}
                      {col.length===0 && (
                        <div style={{ padding:'20px 10px',textAlign:'center',color:'var(--text-muted)',fontSize:12,background:'rgba(255,255,255,0.02)',borderRadius:8,border:'1px dashed var(--border)' }}>No tasks</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <>
          <div className="grid-2" style={{ marginBottom:20 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">LEAKAGE SCORE BY RECORD (FROM CSV)</span></div>
              {barData
                ? <div className="chart-container" style={{ height:240 }}><Bar data={barData} options={CHART_OPTS} /></div>
                : <div className="no-data-state" style={{ padding:'30px 0' }}><div style={{ color:'var(--text-muted)',fontSize:13 }}>No leakage data from CSV</div></div>}
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">TASK STATUS DISTRIBUTION</span></div>
              {taskDough
                ? <div className="chart-container" style={{ height:240 }}><Doughnut data={taskDough} options={{ responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#94a3b8'}}} }} /></div>
                : <div className="no-data-state" style={{ padding:'30px 0' }}><div style={{ color:'var(--text-muted)',fontSize:13 }}>No tasks created yet</div></div>}
            </div>
          </div>
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-header"><span className="card-title">LEAKAGE HEATMAP — CSV DATA</span></div>
            {leakages.length === 0
              ? <div className="no-data-state" style={{ padding:'30px 0' }}><div style={{ color:'var(--text-muted)',fontSize:13 }}>No leakage records detected in CSV</div></div>
              : <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12 }}>
                  {leakages.map(l => (
                    <div key={l.id} style={{ padding:14,borderRadius:8,
                      background:l.severity==='Critical'?'rgba(239,68,68,0.06)':l.severity==='Warning'?'rgba(245,158,11,0.06)':'rgba(34,197,94,0.06)',
                      border:`1px solid ${l.severity==='Critical'?'rgba(239,68,68,0.25)':l.severity==='Warning'?'rgba(245,158,11,0.25)':'rgba(34,197,94,0.25)'}` }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                        <span style={{ fontFamily:'monospace',fontSize:11,color:'var(--text-muted)' }}>{l.id}</span>
                        <span className={`badge ${SEV_BADGE[l.severity]}`} style={{ fontSize:9 }}>{l.severity}</span>
                      </div>
                      <div style={{ fontSize:12,fontWeight:600,color:'var(--text-primary)',marginBottom:2 }}>{l.name}</div>
                      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:8 }}>{l.source==='pipeline'?'🔧 Pipeline segment':'🏙️ Zone'}</div>
                      <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                        <div style={{ flex:1,height:8,background:'rgba(255,255,255,0.06)',borderRadius:4 }}>
                          <div style={{ width:`${Math.min(100,l.leakageScore)}%`,height:'100%',background:SEV_COLOR[l.severity],borderRadius:4 }} />
                        </div>
                        <span style={{ fontSize:12,fontWeight:700,color:SEV_COLOR[l.severity] }}>{l.leakageScore.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
          {tasks.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">TEAM WORKLOAD</span></div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12 }}>
                {TEAMS.map(team => {
                  const tt = tasks.filter(t=>t.team===team);
                  if (tt.length===0) return null;
                  return (
                    <div key={team} className="card" style={{ padding:14,textAlign:'center' }}>
                      <div style={{ fontSize:24,marginBottom:6 }}>👷</div>
                      <div style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)',marginBottom:8 }}>{team}</div>
                      <div style={{ display:'flex',justifyContent:'center',gap:4,flexWrap:'wrap' }}>
                        {tt.filter(t=>t.status==='Pending').length>0 && <span className="badge badge-amber" style={{ fontSize:9 }}>{tt.filter(t=>t.status==='Pending').length} pending</span>}
                        {tt.filter(t=>t.status==='In Progress').length>0 && <span className="badge badge-gray" style={{ fontSize:9 }}>{tt.filter(t=>t.status==='In Progress').length} active</span>}
                        {tt.filter(t=>t.status==='Completed').length>0 && <span className="badge badge-green" style={{ fontSize:9 }}>{tt.filter(t=>t.status==='Completed').length} done</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* DETAIL MODAL */}
      {detailLeak && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div className="card" style={{ width:480,padding:24,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:15,color:'var(--text-primary)' }}>Leakage — {detailLeak.id}</h3>
              <span className={`badge ${SEV_BADGE[detailLeak.severity]}`}>{detailLeak.severity}</span>
            </div>
            {[
              { label:'Source',        value:detailLeak.source==='pipeline'?'🔧 Pipeline Segment':'🏙️ Zone' },
              { label:'Name',           value:detailLeak.name },
              { label:'Zone',           value:detailLeak.zone!=='—'?detailLeak.zone:'—' },
              { label:'Leakage Score',  value:detailLeak.leakageScore.toFixed(1), color:SEV_COLOR[detailLeak.severity] },
              { label:'Avg Loss',       value:detailLeak.avgLoss!=null?detailLeak.avgLoss.toFixed(2):'Not in CSV', color:detailLeak.avgLoss>0?'var(--red)':'var(--text-muted)' },
              { label:'Avg Pressure',   value:detailLeak.avgPressure!=null?detailLeak.avgPressure.toFixed(2):'Not in CSV' },
              { label:'Avg Flow',       value:detailLeak.avgFlow!=null?detailLeak.avgFlow.toFixed(2):'Not in CSV' },
              { label:'Records',        value:detailLeak.recordCount?.toLocaleString()||'—' },
            ].map(r=>(
              <div key={r.label} className="stat-row" style={{ marginBottom:6 }}>
                <span className="stat-label">{r.label}</span>
                <span className="stat-value" style={{ color:r.color||'var(--text-primary)',fontSize:12 }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:16 }}>
              <button className="btn" onClick={()=>setDetailLeak(null)}>Close</button>
              {!tasks.some(t=>t.leakageId===detailLeak.id) && (
                <button className="btn btn-primary" onClick={()=>{ setDetailLeak(null); openNewTask(detailLeak); }}>＋ Assign Task</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW TASK MODAL */}
      {newTask && (
        <TaskModal
          title={`New Task — ${newTask.id} · ${newTask.name}`}
          onSave={createTask}
          onClose={()=>setNewTask(null)}
        />
      )}

      {/* EDIT TASK MODAL */}
      {editTask && (
        <TaskModal
          title={`Edit Task — ${editTask.id}`}
          onSave={saveTask}
          onClose={()=>setEditTask(null)}
        />
      )}
    </div>
  );
}
