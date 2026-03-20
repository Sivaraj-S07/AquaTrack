/**
 * MapViewPage
 * Reads ONLY from GET /api/predictions/zones
 * Zones are positioned radially on the map around a default center.
 * Pipeline links are derived from zone pairs (consumption-based edges).
 * If no zone column → shows clear guidance.
 * Leaflet is loaded dynamically and initialized safely.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const SEV_COLOR = { Critical:'#ef4444', Warning:'#f59e0b', Normal:'#22c55e' };
const SEV_BADGE = { Critical:'badge-red', Warning:'badge-amber', Normal:'badge-green' };
const PALETTE   = ['#06b6d4','#3b82f6','#22c55e','#f59e0b','#a855f7','#f97316','#14b8a6','#ef4444','#ec4899','#8b5cf6'];

function zoneStatus(eff) { return eff < 70 ? 'Critical' : eff < 85 ? 'Warning' : 'Normal'; }

// Spread zones evenly on a circle around the given center
function geoLayout(zones, centerLat, centerLng) {
  const n  = zones.length;
  const r  = 0.025 + Math.min(n * 0.003, 0.02);
  return zones.map((z, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    return {
      ...z,
      lat: parseFloat((centerLat + r * Math.sin(angle)).toFixed(5)),
      lng: parseFloat((centerLng + r * Math.cos(angle)).toFixed(5)),
    };
  });
}

// Build zone–zone links (ring topology, proportional to consumption diff)
function buildLinks(zones) {
  const links = [];
  if (zones.length < 2) return links;
  for (let i = 0; i < zones.length; i++) {
    const a = zones[i], b = zones[(i + 1) % zones.length];
    const avgEff    = ((a.efficiency || 50) + (b.efficiency || 50)) / 2;
    const lossRate  = Math.max(0, 100 - avgEff);
    const status    = lossRate > 20 ? 'Critical' : lossRate > 12 ? 'Warning' : 'Normal';
    links.push({ id:`L${i}`, from:a, to:b, lossRate: parseFloat(lossRate.toFixed(1)), status,
      label:`${a.zone} → ${b.zone}` });
  }
  return links;
}

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

export default function MapViewPage() {
  const navigate      = useNavigate();
  const mapDivRef     = useRef(null);
  const mapObjRef     = useRef(null);   // { L, map }
  const layersRef     = useRef([]);
  const [leafletReady,setLeafletReady]= useState(!!window.L);
  const [mapReady,    setMapReady]    = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [zones,       setZones]       = useState([]);
  const [links,       setLinks]       = useState([]);
  const [noDataset,   setNoDataset]   = useState(false);
  const [noZone,      setNoZone]      = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [filter,      setFilter]      = useState('All');
  const [showZones,   setShowZones]   = useState(true);
  const [showLinks,   setShowLinks]   = useState(true);
  const [showLabels,  setShowLabels]  = useState(true);
  const [tab,         setTab]         = useState('map');

  // ── Load CSV data ─────────────────────────────────────────────
  useEffect(() => {
    api.get('/predictions/zones')
      .then(r => {
        const raw = r.data?.zoneDistribution || [];
        if (raw.length === 0) { setNoZone(true); return; }
        // Default center (adjustable — using a generic urban center)
        const CLat = 13.05, CLng = 80.20;
        const withCoords = geoLayout(
          raw.map((z, i) => ({ ...z, color: PALETTE[i % PALETTE.length] })),
          CLat, CLng
        );
        setZones(withCoords);
        setLinks(buildLinks(withCoords));
      })
      .catch(err => { if (err?.response?.status === 404) setNoDataset(true); })
      .finally(() => setLoading(false));
  }, []);

  // ── Load Leaflet script once ──────────────────────────────────
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    const link   = document.createElement('link');
    link.rel     = 'stylesheet';
    link.href    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.crossOrigin = '';
    document.head.appendChild(link);

    const script    = document.createElement('script');
    script.src      = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async    = true;
    script.crossOrigin = '';
    script.onload   = () => setLeafletReady(true);
    script.onerror  = () => console.error('Leaflet failed to load');
    document.head.appendChild(script);
  }, []);

  // ── Initialize map ────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObjRef.current || zones.length === 0) return;
    const L = window.L;
    // Compute center from zone coordinates
    const avgLat = zones.reduce((s, z) => s + z.lat, 0) / zones.length;
    const avgLng = zones.reduce((s, z) => s + z.lng, 0) / zones.length;
    try {
      const map = L.map(mapDivRef.current, {
        center:           [avgLat, avgLng],
        zoom:             14,
        zoomControl:      true,
        attributionControl: false,
        preferCanvas:     true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 20,
      }).addTo(map);
      mapObjRef.current = { L, map };
      setMapReady(true);
    } catch (e) { console.error('Map init error:', e); }
  }, [leafletReady, zones]);

  // ── Draw / redraw layers ──────────────────────────────────────
  const drawLayers = useCallback(() => {
    if (!mapReady || !mapObjRef.current || zones.length === 0) return;
    const { L, map } = mapObjRef.current;
    layersRef.current.forEach(l => { try { map.removeLayer(l); } catch (_) {} });
    layersRef.current = [];

    const filteredLinks = filter === 'All' ? links : links.filter(l => l.status === filter);

    if (showLinks) {
      filteredLinks.forEach(lk => {
        const color  = SEV_COLOR[lk.status];
        const weight = 3 + lk.lossRate / 10;
        const line   = L.polyline([[lk.from.lat, lk.from.lng], [lk.to.lat, lk.to.lng]], {
          color, weight, opacity: 0.82,
          dashArray: lk.status === 'Critical' ? '8,4' : null,
        }).addTo(map);
        line.on('click', () => setSelected({ type:'link', data:lk }));
        line.on('mouseover', function () { this.setStyle({ weight: weight + 4, opacity: 1 }); });
        line.on('mouseout',  function () { this.setStyle({ weight, opacity: 0.82 }); });
        line.bindTooltip(
          `<b>${lk.label}</b><br/>Est. Loss Rate: ${lk.lossRate}%<br/>Status: <span style="color:${color}">${lk.status}</span>`,
          { sticky: true, className: 'aqtmap-tt' }
        );
        layersRef.current.push(line);
        if (lk.status === 'Critical') {
          const midLat = (lk.from.lat + lk.to.lat) / 2;
          const midLng = (lk.from.lng + lk.to.lng) / 2;
          const mk = L.circleMarker([midLat, midLng], { radius:7, color:'#ef4444', fillColor:'#ef4444', fillOpacity:0.8, weight:2 }).addTo(map);
          mk.bindTooltip('⚠️ Critical Link', { className:'aqtmap-tt' });
          layersRef.current.push(mk);
        }
      });
    }

    if (showZones) {
      zones.forEach(z => {
        const maxTotal = Math.max(...zones.map(zz => zz.total), 1);
        const radius   = 500 + (z.total / maxTotal) * 1200;
        const c = L.circle([z.lat, z.lng], { radius, color:z.color, fillColor:z.color, fillOpacity:0.08, weight:2 }).addTo(map);
        c.on('click', () => setSelected({ type:'zone', data:z }));
        c.bindTooltip(
          `<b>${z.zone}</b><br/>Total: ${z.total?.toLocaleString(undefined,{maximumFractionDigits:2})}<br/>Efficiency: ${z.efficiency||0}%<br/>Anomalies: ${z.anomalies||0}`,
          { sticky:true, className:'aqtmap-tt' }
        );
        layersRef.current.push(c);
      });
    }

    if (showLabels) {
      zones.forEach(z => {
        const icon = L.divIcon({
          html:`<div style="background:${z.color};color:#fff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;font-family:Inter,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.6);">🏙️ ${z.zone}</div>`,
          className:'', iconAnchor:[50,8],
        });
        const mk = L.marker([z.lat, z.lng], { icon, interactive:false }).addTo(map);
        layersRef.current.push(mk);
      });
    }
  }, [mapReady, zones, links, filter, showZones, showLinks, showLabels]);

  useEffect(() => { drawLayers(); }, [drawLayers]);

  // ── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (mapObjRef.current) {
        try { mapObjRef.current.map.remove(); } catch (_) {}
        mapObjRef.current = null;
      }
    };
  }, []);

  if (loading) return <div className="page-wrapper"><div className="loading-center"><div className="spinner" /><span>Loading map data…</span></div></div>;

  if (noDataset) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">🗺️ Geographic Map View</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">📤</div>
          <div className="no-data-title">No dataset uploaded yet</div>
          <div className="no-data-sub">Upload a CSV with a zone column to generate the interactive map. Try <b>01_full_featured.csv</b> or <b>02_zone_only.csv</b>.</div>
          <button className="btn btn-primary" style={{ marginTop:20 }} onClick={() => navigate('/upload')}>📤 Upload CSV Dataset</button>
        </div>
      </div>
    </div>
  );

  const critLinks = links.filter(l => l.status === 'Critical').length;
  const totalZones = zones.length;
  const TABS = [
    { id:'map',   label:'🗺️ Map View' },
    { id:'table', label:'📋 Zone Table' },
    { id:'links', label:`🔗 Links (${links.length})` },
  ];

  return (
    <div className="page-wrapper">
      <style>{`
        .aqtmap-tt {
          background:#141e2e!important; border:1px solid rgba(99,179,237,0.3)!important;
          color:#e2e8f0!important; font-family:Inter,sans-serif!important;
          font-size:12px!important; border-radius:8px!important;
          padding:8px 12px!important; box-shadow:0 4px 16px rgba(0,0,0,0.6)!important;
        }
        .aqtmap-tt::before { display:none!important; }
        .leaflet-control-zoom a { background:#141e2e!important; color:#06b6d4!important; border-color:rgba(99,179,237,0.2)!important; }
        .leaflet-control-zoom a:hover { background:#1a2640!important; }
        .leaflet-bar { border:1px solid rgba(99,179,237,0.2)!important; }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">🗺️ Geographic Map View</h1>
        <p className="page-subtitle">Interactive map — zones and links auto-generated from your uploaded CSV</p>
      </div>

      {noZone && (
        <MissingDataNotice
          title="Zone column not detected in your CSV"
          message="The map requires a zone/area column to position and display zones. Add one of these columns, or upload a sample dataset that includes zone data:"
          columns={['zone','area','district','region','sector','location','block','ward']}
        />
      )}

      {!noZone && (
        <>
          {/* KPIs */}
          <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(5,1fr)' }}>
            <div className="kpi-card" style={{ '--kpi-color':'var(--blue)' }}><div className="kpi-icon">🏙️</div><div className="kpi-label">Zones</div><div className="kpi-value" style={{ color:'var(--blue)' }}>{totalZones}</div><div className="kpi-sub">from CSV</div></div>
            <div className="kpi-card" style={{ '--kpi-color':'var(--purple)' }}><div className="kpi-icon">🔗</div><div className="kpi-label">Links</div><div className="kpi-value" style={{ color:'var(--purple)' }}>{links.length}</div><div className="kpi-sub">derived connections</div></div>
            <div className="kpi-card" style={{ '--kpi-color':critLinks>0?'var(--red)':'var(--green)' }}><div className="kpi-icon">🚨</div><div className="kpi-label">Critical Links</div><div className="kpi-value" style={{ color:critLinks>0?'var(--red)':'var(--green)' }}>{critLinks}</div><div className="kpi-sub">high loss rate</div></div>
            <div className="kpi-card" style={{ '--kpi-color':'var(--cyan)' }}><div className="kpi-icon">🌊</div><div className="kpi-label">Total Consumption</div><div className="kpi-value" style={{ color:'var(--cyan)', fontSize:20 }}>{zones.reduce((s,z)=>s+(z.total||0),0).toLocaleString(undefined,{maximumFractionDigits:0})}</div><div className="kpi-sub">all zones</div></div>
            <div className="kpi-card" style={{ '--kpi-color':'var(--green)' }}><div className="kpi-icon">✅</div><div className="kpi-label">Avg Efficiency</div><div className="kpi-value" style={{ color:'var(--green)', fontSize:20 }}>{zones.length?(zones.reduce((s,z)=>s+(z.efficiency||0),0)/zones.length).toFixed(1):'—'}%</div><div className="kpi-sub">across zones</div></div>
          </div>

          <div className="tabs">{TABS.map(tb=><button key={tb.id} className={`tab-btn${tab===tb.id?' active':''}`} onClick={()=>setTab(tb.id)}>{tb.label}</button>)}</div>

          {/* MAP TAB */}
          {tab === 'map' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                {/* Controls */}
                <div style={{ padding:'11px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <span className="card-title" style={{ marginRight:6 }}>FILTER & LAYERS</span>
                  {['All','Critical','Warning','Normal'].map(s => (
                    <button key={s} className={`tab-btn${filter===s?' active':''}`}
                      style={{ fontSize:11, padding:'3px 10px', borderLeft:s!=='All'?`3px solid ${SEV_COLOR[s]||'var(--border)'}`:'' }}
                      onClick={() => setFilter(s)}>{s}</button>
                  ))}
                  <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                    {[['showZones','Zones',showZones,setShowZones],['showLinks','Links',showLinks,setShowLinks],['showLabels','Labels',showLabels,setShowLabels]].map(([,label,val,setter]) => (
                      <button key={label} className={`tab-btn${val?' active':''}`} style={{ fontSize:11 }} onClick={() => setter(v=>!v)}>
                        {val?'✓':''} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Map container */}
                <div style={{ position:'relative' }}>
                  <div ref={mapDivRef} style={{ height:500, background:'#080d1a' }} />
                  {(!mapReady || !leafletReady) && (
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#080d1a', zIndex:999 }}>
                      <div style={{ textAlign:'center', color:'var(--text-muted)' }}>
                        <div className="spinner" style={{ margin:'0 auto 12px' }} />
                        <div style={{ fontSize:13 }}>Loading map…</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:16, fontSize:11, color:'var(--text-muted)', flexWrap:'wrap' }}>
                  {[['#ef4444','Critical'],['#f59e0b','Warning'],['#22c55e','Normal']].map(([c,l]) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:18,height:4,background:c,borderRadius:2 }} />{l}</div>
                  ))}
                  <span>Circle size = consumption</span>
                  <span style={{ marginLeft:'auto', fontSize:10 }}>Click zone or link for details</span>
                </div>
              </div>

              {/* Side panel */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {selected?.type === 'zone' && (() => {
                  const z = selected.data;
                  const st = zoneStatus(z.efficiency||0);
                  return (
                    <div className="card">
                      <div className="card-header"><span className="card-title">ZONE</span><span className={`badge ${SEV_BADGE[st]}`}>{st}</span></div>
                      <div style={{ fontSize:14, fontWeight:700, color:z.color, marginBottom:12 }}>{z.zone}</div>
                      {[
                        { label:'Total', value:z.total?.toLocaleString(undefined,{maximumFractionDigits:2}), color:'var(--cyan)' },
                        { label:'Average', value:z.avg?.toFixed(2), color:'var(--blue)' },
                        { label:'Records', value:z.count?.toLocaleString(), color:'var(--text-secondary)' },
                        { label:'Anomalies', value:z.anomalies, color:z.anomalies>0?'var(--amber)':'var(--green)' },
                        { label:'Efficiency', value:`${z.efficiency||0}%`, color:SEV_COLOR[st] },
                      ].map(r => (
                        <div key={r.label} className="stat-row">
                          <span className="stat-label">{r.label}</span>
                          <span className="stat-value" style={{ color:r.color }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {selected?.type === 'link' && (() => {
                  const lk = selected.data;
                  return (
                    <div className="card">
                      <div className="card-header"><span className="card-title">LINK</span><span className={`badge ${SEV_BADGE[lk.status]}`}>{lk.status}</span></div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:12 }}>{lk.label}</div>
                      {[
                        { label:'Est. Loss Rate', value:`${lk.lossRate}%`, color:SEV_COLOR[lk.status] },
                      ].map(r => (
                        <div key={r.label} className="stat-row">
                          <span className="stat-label">{r.label}</span>
                          <span className="stat-value" style={{ color:r.color }}>{r.value}</span>
                        </div>
                      ))}
                      <div className="alert alert-info" style={{ marginTop:10, fontSize:11 }}>Links are derived from zone efficiency data. For accurate pipeline metrics, add <code>pipe_segment</code>, <code>flow_rate</code>, and <code>leakage</code> columns.</div>
                    </div>
                  );
                })()}

                {!selected && (
                  <div className="card">
                    <div className="card-header"><span className="card-title">MAP GUIDE</span></div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.9 }}>
                      <p>🖱️ <b style={{ color:'var(--text-secondary)' }}>Click</b> any zone circle or link.</p>
                      <p>🔍 <b style={{ color:'var(--text-secondary)' }}>Scroll</b> to zoom.</p>
                      <p>🎯 <b style={{ color:'var(--text-secondary)' }}>Drag</b> to pan.</p>
                      <p style={{ marginTop:8, fontSize:11 }}>Zone positions are auto-calculated from your CSV data. All metrics come exclusively from your uploaded file.</p>
                    </div>
                  </div>
                )}

                <div className="card" style={{ flex:1 }}>
                  <div className="card-header"><span className="card-title">ZONES</span><span className="badge badge-gray">{zones.length}</span></div>
                  <div style={{ overflowY:'auto', maxHeight:320 }}>
                    {zones.map(z => {
                      const st = zoneStatus(z.efficiency||0);
                      return (
                        <div key={z.zone}
                          onClick={() => { setSelected({ type:'zone', data:z }); if (mapObjRef.current) mapObjRef.current.map.setView([z.lat,z.lng],15); }}
                          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 8px', borderRadius:6, marginBottom:3, cursor:'pointer',
                            background:selected?.data?.zone===z.zone?'rgba(99,179,237,0.08)':'rgba(255,255,255,0.02)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:8,height:8,borderRadius:'50%',background:z.color }} />
                            <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{z.zone}</span>
                          </div>
                          <span className={`badge ${SEV_BADGE[st]}`} style={{ fontSize:9 }}>{z.efficiency||0}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ZONE TABLE */}
          {tab === 'table' && (
            <div className="card">
              <div className="card-header"><span className="card-title">ZONE TABLE FROM CSV</span><span className="badge badge-gray">{zones.length}</span></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Zone</th><th>Total</th><th>Average</th><th>Records</th><th>Anomalies</th><th>Efficiency</th><th>Status</th></tr></thead>
                  <tbody>
                    {zones.map((z, i) => {
                      const st = zoneStatus(z.efficiency||0);
                      return (
                        <tr key={z.zone}>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ width:10,height:10,borderRadius:'50%',background:PALETTE[i%PALETTE.length],display:'inline-block' }} />
                              <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{z.zone}</span>
                            </div>
                          </td>
                          <td style={{ color:'var(--cyan)', fontWeight:600 }}>{z.total?.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                          <td>{z.avg?.toFixed(2)}</td>
                          <td style={{ color:'var(--text-muted)' }}>{z.count?.toLocaleString()}</td>
                          <td style={{ color:z.anomalies>0?'var(--amber)':'var(--green)' }}>{z.anomalies}</td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <div style={{ width:50,height:6,background:'rgba(255,255,255,0.06)',borderRadius:3 }}>
                                <div style={{ width:`${z.efficiency||0}%`,height:'100%',background:(z.efficiency||0)>=90?'var(--green)':(z.efficiency||0)>=75?'var(--amber)':'var(--red)',borderRadius:3 }} />
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

          {/* LINKS TABLE */}
          {tab === 'links' && (
            <div className="card">
              <div className="card-header"><span className="card-title">ZONE CONNECTIONS</span><span className="badge badge-gray">{links.length}</span></div>
              <div className="alert alert-info" style={{ marginBottom:16 }}>
                These connections are derived from zone efficiency data in your CSV. For real pipeline metrics, add <code>pipe_segment</code>, <code>flow_rate</code>, and <code>leakage</code> columns to your CSV.
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>From</th><th>To</th><th>Est. Loss Rate</th><th>Status</th></tr></thead>
                  <tbody>
                    {links.map((lk, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ width:8,height:8,borderRadius:'50%',background:lk.from.color,display:'inline-block' }} />
                            <span style={{ color:'var(--text-primary)' }}>{lk.from.zone}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ width:8,height:8,borderRadius:'50%',background:lk.to.color,display:'inline-block' }} />
                            <span style={{ color:'var(--text-primary)' }}>{lk.to.zone}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:50,height:6,background:'rgba(255,255,255,0.06)',borderRadius:3 }}>
                              <div style={{ width:`${Math.min(100,lk.lossRate*4)}%`,height:'100%',background:SEV_COLOR[lk.status],borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:12, color:SEV_COLOR[lk.status] }}>{lk.lossRate}%</span>
                          </div>
                        </td>
                        <td><span className={`badge ${SEV_BADGE[lk.status]}`}>{lk.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {noZone && (
        <div className="card">
          <div className="no-data-state">
            <div className="no-data-icon">🗺️</div>
            <div className="no-data-title">Map unavailable — zone data not found in CSV</div>
            <div className="no-data-sub">Add a zone/area column to your CSV, or try sample datasets <b>01_full_featured.csv</b> or <b>02_zone_only.csv</b>.</div>
          </div>
        </div>
      )}
    </div>
  );
}
