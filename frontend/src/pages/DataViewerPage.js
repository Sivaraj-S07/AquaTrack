import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import api from '../utils/api';

export default function DataViewerPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [rows, setRows]       = useState([]);
  const [columns, setColumns] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 50;

  const fetchData = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/predictions/data?page=${p}&limit=${LIMIT}`);
      setRows(data.data || []); setColumns(data.columns || []); setTotal(data.total || 0); setPage(p);
    } catch { setRows([]); setColumns([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(0); }, [fetchData]);

  const filteredRows = search ? rows.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))) : rows;
  const totalPages = Math.ceil(total / LIMIT);

  if (!loading && columns.length === 0) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-title">{t.dataViewer.title}</h1></div>
      <div className="card">
        <div className="no-data-state">
          <div className="no-data-icon">🗂️</div>
          <div className="no-data-title">{t.dataViewer.noData}</div>
          <div className="no-data-sub">{t.dataViewer.noDataSub}</div>
          <button className="btn btn-primary" style={{ marginTop:20 }} onClick={() => navigate('/upload')}>{t.dataViewer.uploadCsv}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">{t.dataViewer.title}</h1>
          <p className="page-subtitle">{total.toLocaleString()} {t.dataViewer.totalRows} · {columns.length} {t.dataViewer.columnsLabel} · {t.dataViewer.page} {page + 1} {t.dataViewer.of} {totalPages || 1}</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input className="form-input" style={{ width:220 }} placeholder={t.dataViewer.searchPlaceholder}
            value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/upload')}>{t.dataViewer.reupload}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16, padding:'12px 16px' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--text-muted)', marginRight:4 }}>{t.dataViewer.columns}</span>
          {columns.map(col => <span key={col} className="badge badge-cyan">{col}</span>)}
        </div>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div className="loading-center" style={{ padding:40 }}><div className="spinner" /></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th style={{ width:50 }}>{t.dataViewer.rowNumber}</th>{columns.map(col => <th key={col}>{col}</th>)}</tr></thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={columns.length + 1} style={{ textAlign:'center', color:'var(--text-muted)', padding:'24px 0' }}>{t.dataViewer.noMatchingRows}</td></tr>
                ) : filteredRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ color:'var(--text-muted)', fontSize:11 }}>{page * LIMIT + i + 1}</td>
                    {columns.map(col => (
                      <td key={col} style={{ maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {row[col] ?? <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{t.dataViewer.showing} {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} {t.dataViewer.of} {total.toLocaleString()}</span>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => fetchData(page - 1)}>{t.dataViewer.prev}</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                return <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => fetchData(p)}>{p + 1}</button>;
              })}
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => fetchData(page + 1)}>{t.dataViewer.next}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
