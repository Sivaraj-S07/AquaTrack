import React, { useEffect, useState, useCallback } from 'react';
import { useI18n } from '../i18n/I18nContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

function StatCard({ label, value, icon, color = 'var(--cyan)' }) {
  return (
    <div className="kpi-card" style={{ '--kpi-color': color }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value ?? '—'}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([api.get('/admin/stats'), api.get('/admin/users')]);
      setStats(s.data); setUsers(u.data.users);
    } catch { toast.error(t.admin.loadError); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleUser = async (id) => {
    try {
      const { data } = await api.patch(`/admin/users/${id}/toggle`);
      setUsers(us => us.map(u => u._id === id ? { ...u, isActive: data.isActive } : u));
      toast.success(data.message);
    } catch { toast.error(t.admin.toggleError); }
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`${t.admin.deleteConfirm} "${name}" ${t.admin.deleteWarning}`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(us => us.filter(u => u._id !== id));
      toast.success(t.admin.userDeleted);
    } catch { toast.error(t.admin.deleteError); }
  };

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="page-wrapper"><div className="loading-center"><div className="spinner" /><span>{t.admin.loadingAdmin}</span></div></div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header flex-between">
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <h1 className="page-title" style={{ margin:0 }}>{t.admin.title}</h1>
            <span className="admin-chip">{t.admin.adminPortal}</span>
          </div>
          <p className="page-subtitle">{t.admin.subtitle}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll}>{t.admin.refresh}</button>
      </div>

      <div className="kpi-grid" style={{ marginBottom:24 }}>
        <StatCard label={t.admin.totalUsers}    value={stats?.totalUsers}    icon="👥" color="var(--cyan)" />
        <StatCard label={t.admin.usersWithData} value={stats?.usersWithData} icon="📊" color="var(--green)" />
        <StatCard label={t.admin.totalDatasets} value={stats?.totalDatasets} icon="📁" color="var(--blue)" />
        <StatCard label={t.admin.activeRate}
          value={stats?.totalUsers > 0 ? `${Math.round(stats.usersWithData / stats.totalUsers * 100)}%` : '0%'}
          icon="📈" color="var(--teal)" />
      </div>

      {stats?.recentUsers?.length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-header"><span className="card-title">{t.admin.recentSignups}</span></div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {stats.recentUsers.map(u => (
              <div key={u._id} style={{ background:'var(--bg-hover)', borderRadius:8, padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
                <div className="user-avatar" style={{ width:26, height:26, fontSize:11 }}>{u.name?.[0]?.toUpperCase()}</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{u.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</div>
                </div>
                {u.currentDatasetId && <span className="badge badge-green" style={{ fontSize:9 }}>{t.admin.hasData}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header flex-between" style={{ marginBottom:16 }}>
          <span className="card-title">{t.admin.allUsers} ({filtered.length})</span>
          <input className="form-input" style={{ width:220, padding:'6px 12px' }}
            placeholder={t.admin.searchUsers} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <div className="no-data-state" style={{ padding:'40px 24px' }}>
            <div className="no-data-icon">👥</div>
            <div className="no-data-title">{search ? t.admin.noMatchingUsers : t.admin.noUsers}</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>{t.admin.user}</th><th>{t.admin.email}</th><th>{t.admin.status}</th><th>{t.admin.dataset}</th><th>{t.admin.lastLogin}</th><th>{t.admin.joined}</th><th>{t.admin.actions}</th></tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user._id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="user-avatar" style={{ width:28, height:28, fontSize:11 }}>{user.name?.[0]?.toUpperCase()}</div>
                        <strong style={{ color:'var(--text-primary)' }}>{user.name}</strong>
                      </div>
                    </td>
                    <td style={{ color:'var(--text-muted)' }}>{user.email}</td>
                    <td><span className={`badge badge-${user.isActive ? 'green' : 'red'}`}>{user.isActive ? t.admin.active : t.admin.inactive}</span></td>
                    <td>
                      {user.dataset ? (
                        <div>
                          <div style={{ fontSize:12, color:'var(--cyan)' }}>{user.dataset.originalName}</div>
                          <div style={{ fontSize:10, color:'var(--text-muted)' }}>{user.dataset.rowCount?.toLocaleString()} {t.admin.rows}</div>
                        </div>
                      ) : <span className="badge badge-gray">{t.admin.noData}</span>}
                    </td>
                    <td style={{ color:'var(--text-muted)', fontSize:12 }}>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '—'}</td>
                    <td style={{ color:'var(--text-muted)', fontSize:12 }}>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize:11, padding:'4px 8px', color: user.isActive ? 'var(--amber)' : 'var(--green)' }}
                          onClick={() => toggleUser(user._id)}>
                          {user.isActive ? t.admin.deactivate : t.admin.activate}
                        </button>
                        <button className="btn btn-danger btn-sm" style={{ fontSize:11, padding:'4px 8px' }}
                          onClick={() => deleteUser(user._id, user.name)}>{t.admin.deleteUser}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
