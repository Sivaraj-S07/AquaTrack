import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef();

  const validateFile = (f) => {
    if (!f) return 'No file selected';
    if (!f.name.endsWith('.csv') && f.type !== 'text/csv') return t.upload.onlyCsv;
    if (f.size > 20 * 1024 * 1024) return t.upload.maxSize;
    return null;
  };

  const pickFile = (f) => {
    const err = validateFile(f);
    if (err) { setError(err); setFile(null); return; }
    setError(''); setFile(f); setResult(null);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setProgress(0); setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 90)); },
      });
      setProgress(100); setResult(data);
      await refreshUser();
      toast.success(t.upload.uploadSuccess);
    } catch (err) {
      setError(err.response?.data?.error || t.upload.uploadFailed);
      toast.error(t.upload.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t.upload.removeConfirm)) return;
    try {
      await api.delete('/upload');
      await refreshUser();
      setResult(null); setFile(null);
      toast.success(t.upload.datasetRemoved);
    } catch { toast.error(t.upload.removeFailed); }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">{t.upload.title}</h1>
          <p className="page-subtitle">{t.upload.subtitle}</p>
        </div>
        {user?.hasDataset && <button className="btn btn-danger btn-sm" onClick={handleDelete}>{t.upload.removeDataset}</button>}
      </div>

      {!result && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className={`upload-zone${dragOver ? ' drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)} onDrop={onDrop}
            onClick={() => inputRef.current?.click()}>
            <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={(e) => pickFile(e.target.files?.[0])} />
            <div className="upload-icon">📂</div>
            {file ? (
              <>
                <div className="upload-title" style={{ color: 'var(--cyan)' }}>✅ {file.name}</div>
                <div className="upload-sub">{(file.size / 1024).toFixed(1)} KB {t.upload.readyToUpload}</div>
              </>
            ) : (
              <>
                <div className="upload-title">{t.upload.dragDrop}</div>
                <div className="upload-sub">{t.upload.orBrowse}</div>
              </>
            )}
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
          {file && !uploading && (
            <button className="btn btn-primary" style={{ marginTop: 16, justifyContent: 'center', width: '100%' }} onClick={handleUpload}>
              {t.upload.processBtn}
            </button>
          )}
          {uploading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{t.upload.processing}</span><span>{progress}%</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(34,197,94,0.2)' }}>
          <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ color: 'var(--green)', marginBottom: 8 }}>{t.upload.datasetProcessed}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{result.dataset?.originalName}</strong> — {result.dataset?.rowCount?.toLocaleString()} rows across {result.dataset?.columns?.length} columns
            </p>
          </div>
          <div className="kpi-grid" style={{ marginTop: 20 }}>
            {[
              { label: t.upload.totalRecords, value: result.predictions?.totalRows?.toLocaleString(), icon: '📋', color: 'var(--cyan)' },
              { label: t.upload.numericCols,  value: result.predictions?.numericColumns, icon: '🔢', color: 'var(--blue)' },
              { label: t.upload.trendLabel,   value: result.predictions?.overallTrend || '—', icon: '📈', color: 'var(--green)' },
              { label: t.upload.anomaliesLabel, value: result.predictions?.totalAnomalies, icon: '⚠️', color: 'var(--amber)' },
            ].map(k => (
              <div key={k.label} className="kpi-card" style={{ '--kpi-color': k.color }}>
                <div className="kpi-icon">{k.icon}</div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ color: k.color }}>{k.value ?? '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>{t.upload.viewDashboard}</button>
            <button className="btn btn-secondary" onClick={() => navigate('/predict')}>{t.upload.viewPredictions}</button>
            <button className="btn btn-secondary" onClick={() => navigate('/pipeline')}>{t.upload.viewPipeline}</button>
            <button className="btn btn-secondary" onClick={() => { setResult(null); setFile(null); }}>{t.upload.uploadAnother}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">{t.upload.csvGuidelines}</span></div>
        <div className="grid-2">
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--cyan)' }}>{t.upload.recommendedCols}</h4>
            {[
              [t.upload.dateCol,        t.upload.dateColEx,        'var(--text-muted)'],
              [t.upload.consumptionCol, t.upload.consumptionEx,    'var(--green)'],
              [t.upload.zoneCol,        t.upload.zoneEx,           'var(--blue)'],
              [t.upload.pressureCol,    t.upload.pressureEx,       'var(--amber)'],
              [t.upload.flowCol,        t.upload.flowEx,           'var(--purple)'],
              [t.upload.leakageCol,     t.upload.leakageEx,        'var(--red)'],
            ].map(([col, ex, color]) => (
              <div key={col} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <span style={{ color, fontSize: 13, fontWeight: 600, minWidth: 160 }}>{col}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ex}</span>
              </div>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--cyan)' }}>{t.upload.sampleHeader}</h4>
            <pre style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 11, color: 'var(--text-secondary)', overflowX: 'auto', border: '1px solid var(--border)' }}>
{`date,zone,consumption,pressure,flow_rate,leakage
2024-01-01,Zone-A,1250,45.2,320,12.5
2024-01-01,Zone-B,980,43.8,280,8.2
2024-01-02,Zone-A,1310,44.9,325,13.1`}
            </pre>
            <div className="alert alert-info" style={{ marginTop: 12, fontSize: 12 }}>{t.upload.autDetect}</div>
          </div>
        </div>
      </div>

      {/* Sample Datasets Guide */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><span className="card-title">📁 SAMPLE DATASETS</span><span className="badge badge-cyan">4 datasets included</span></div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Four sample CSV files are included in the <code>sample_datasets/</code> folder of the project. Each demonstrates different data scenarios and unlocks different features.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {[
            {
              file: '01_full_featured.csv',
              color: 'var(--green)',
              badge: '✅ All Features',
              rows: '450 rows · 5 zones · 5 segments · 90 days',
              desc: 'Full dataset with zone, pipe_segment, pressure, flow_rate, leakage, and temperature columns. Unlocks all pages including Pipeline Viz, Map View, Zone Management, and Leakage Workflow.',
              unlocks: ['Dashboard','Analytics','Predictions','Pipeline Monitor','Zone Management','Pipeline Viz','Map View','Leakage Workflow'],
            },
            {
              file: '02_zone_only.csv',
              color: 'var(--blue)',
              badge: '🗺️ Zone Focus',
              rows: '720 rows · 6 zones · 120 days',
              desc: 'Zone-only dataset with consumption, temperature, population and revenue. No pipeline/segment columns. Zone Management and Map View work; Pipeline Viz and Leakage (segment) show incomplete-data notices.',
              unlocks: ['Dashboard','Analytics','Predictions','Zone Management','Map View'],
            },
            {
              file: '03_pipeline_crisis.csv',
              color: 'var(--red)',
              badge: '🚨 Crisis Scenario',
              rows: '420 rows · 7 segments · 60 days',
              desc: 'Pipeline-only dataset with high leakage (Junction-1 critical, Branch-A worsening). No zone column. Pipeline Viz and Leakage Workflow fully active; Zone/Map pages show incomplete-data notice.',
              unlocks: ['Dashboard','Predictions','Pipeline Monitor','Pipeline Viz','Leakage Workflow'],
            },
            {
              file: '04_minimal.csv',
              color: 'var(--amber)',
              badge: '📉 Minimal Data',
              rows: '180 rows · single meter · 180 days',
              desc: 'Single consumption time series with no zone or pipeline columns. Dashboard, Predictions, and Analytics work. All pipeline/zone pages show clear "incomplete data" notices explaining what columns to add.',
              unlocks: ['Dashboard','Analytics','Predictions'],
            },
          ].map(ds => (
            <div key={ds.file} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, borderLeft: `3px solid ${ds.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <code style={{ fontSize: 12, color: ds.color, fontWeight: 700 }}>{ds.file}</code>
                <span style={{ fontSize: 10, background: `${ds.color}22`, color: ds.color, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{ds.badge}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{ds.rows}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{ds.desc}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ds.unlocks.map(u => <span key={u} style={{ fontSize: 10, background: 'rgba(99,179,237,0.1)', color: 'var(--cyan)', padding: '2px 7px', borderRadius: 8 }}>{u}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div className="alert alert-warning" style={{ marginTop: 16, fontSize: 12 }}>
          <strong>Important:</strong> Every page in this application depends solely on your uploaded CSV file. No data is assumed, generated, or hardcoded. If a required column is missing, the corresponding page will show an explicit notice explaining exactly which columns to add.
        </div>
      </div>

    </div>
  );
}
