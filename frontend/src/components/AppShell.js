import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import toast from 'react-hot-toast';

export default function AppShell({ children, admin = false }) {
  const { user, logout } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const USER_NAV = [
    { label: t.nav.overview,          icon: '🏠', path: '/' },
    { label: t.nav.uploadCsv,         icon: '📤', path: '/upload' },
    { label: t.nav.predictions,       icon: '🔮', path: '/predict' },
    { label: t.nav.analytics,         icon: '📊', path: '/analytics' },
    { label: t.nav.waterSavings,      icon: '💧', path: '/savings' },
    { label: t.nav.pipelineMonitor,   icon: '🔧', path: '/pipeline' },
    { label: t.nav.zoneManagement || 'Zone Management', icon: '🏙️', path: '/zones' },
    { label: t.nav.pipelineViz || 'Pipeline Viz',       icon: '🗜️', path: '/viz' },
    { label: t.nav.mapView || 'Map View',               icon: '🗺️', path: '/map' },
    { label: t.nav.leakageWorkflow || 'Leakage Workflow', icon: '🔍', path: '/leakage' },
    { label: t.nav.dataViewer,        icon: '🗂️',  path: '/data' },
    { label: 'Profile',               icon: '👤', path: '/profile' },
  ];
  const ADMIN_NAV = [{ label: t.nav.dashboard, icon: '🛡️', path: '/admin' }];
  const navItems = admin ? ADMIN_NAV : USER_NAV;

  const handleLogout = () => {
    logout();
    toast.success(t.common.loggedOut);
    navigate(admin ? '/admin/login' : '/login');
  };

  const isActive = (path) => {
    if (path === '/' || path === '/admin') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app-layout">
      <aside className="sidebar" style={collapsed ? { width: 60 } : {}}>
        <div className="sidebar-logo" style={{ cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
          <div className="logo-icon">💧</div>
          {!collapsed && (
            <div>
              <div className="logo-text">AquaTrack</div>
              <div className="logo-sub">{admin ? t.nav.adminPortal : t.nav.proPlatform}</div>
            </div>
          )}
        </div>
        <nav className="sidebar-nav" style={{ overflowY: 'auto' }}>
          {!collapsed && <div className="nav-section-title">{admin ? t.nav.administration : t.nav.navigation}</div>}
          {navItems.map(item => (
            <div key={item.path} className={`nav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={() => navigate(item.path)} title={collapsed ? item.label : ''}>
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="nav-item" onClick={toggleLang} title={t.common.language} style={{ color: 'var(--cyan)', marginBottom: 4 }}>
            <span className="nav-icon">🌐</span>
            {!collapsed && <span style={{ fontSize: 12 }}>{lang === 'ta' ? 'English' : 'தமிழ்'}</span>}
          </div>
          {!collapsed && (
            <div className="user-badge" style={{ marginBottom: 8 }}>
              <div className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
              <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'User'}</div>
                <div className="user-role">{admin ? t.common.admin : t.common.userRole}</div>
              </div>
            </div>
          )}
          <div className="nav-item" onClick={handleLogout} title={t.nav.logout} style={{ color: '#ef4444' }}>
            <span className="nav-icon">🚪</span>
            {!collapsed && <span>{t.nav.logout}</span>}
          </div>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
