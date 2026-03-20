import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import AppShell from './components/AppShell';

// Auth pages
import UserLoginPage   from './pages/UserLoginPage';
import UserSignupPage  from './pages/UserSignupPage';
import AdminLoginPage  from './pages/AdminLoginPage';

// User pages
import DashboardPage       from './pages/DashboardPage';
import UploadPage          from './pages/UploadPage';
import PredictionsPage     from './pages/PredictionsPage';
import AnalyticsPage       from './pages/AnalyticsPage';
import PipelineMonitorPage from './pages/PipelineMonitorPage';
import DataViewerPage      from './pages/DataViewerPage';
import WaterSavingsPage    from './pages/WaterSavingsPage';
import ProfilePage         from './pages/ProfilePage';

// New feature pages
import ZoneManagementPage      from './pages/ZoneManagementPage';
import PipelineVisualizationPage from './pages/PipelineVisualizationPage';
import MapViewPage              from './pages/MapViewPage';
import LeakageWorkflowPage      from './pages/LeakageWorkflowPage';

// Admin pages
import AdminDashboardPage from './pages/AdminDashboardPage';

import './styles/global.css';

/* ── Route Guards ───────────────────────────────────────── */
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e' }}>
      <div className="spinner" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (!adminOnly && user.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#141e2e',
            color: '#e2e8f0',
            border: '1px solid rgba(99,179,237,0.15)',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#0a0f1e' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#0a0f1e' } },
        }}
      />
      <Routes>
        {/* ── Public Auth ── */}
        <Route path="/login"       element={<GuestRoute><UserLoginPage /></GuestRoute>} />
        <Route path="/signup"      element={<GuestRoute><UserSignupPage /></GuestRoute>} />
        <Route path="/admin/login" element={<GuestRoute><AdminLoginPage /></GuestRoute>} />

        {/* ── User Protected ── */}
        <Route path="/*" element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/"          element={<DashboardPage />} />
                <Route path="/upload"    element={<UploadPage />} />
                <Route path="/predict"   element={<PredictionsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/savings"   element={<WaterSavingsPage />} />
                <Route path="/pipeline"  element={<PipelineMonitorPage />} />
                <Route path="/data"      element={<DataViewerPage />} />
                <Route path="/profile"  element={<ProfilePage />} />
                <Route path="/zones"    element={<ZoneManagementPage />} />
                <Route path="/viz"      element={<PipelineVisualizationPage />} />
                <Route path="/map"      element={<MapViewPage />} />
                <Route path="/leakage"  element={<LeakageWorkflowPage />} />
                <Route path="*"         element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        } />

        {/* ── Admin Protected ── */}
        <Route path="/admin/*" element={
          <ProtectedRoute adminOnly>
            <AppShell admin>
              <Routes>
                <Route path="/"  element={<AdminDashboardPage />} />
                <Route path="*"  element={<Navigate to="/admin" replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default function Root() {
  return (
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  );
}
