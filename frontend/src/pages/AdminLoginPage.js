import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const { loginAdmin } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAdmin(form.email, form.password);
      toast.success(t.auth.adminGranted);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || t.auth.invalidAdmin);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ backgroundImage: 'radial-gradient(ellipse at 30% 40%,rgba(124,58,237,0.08) 0%,transparent 60%),radial-gradient(ellipse at 70% 70%,rgba(79,70,229,0.06) 0%,transparent 60%)' }}>
      <div className="auth-card" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            type="button"
            onClick={toggleLang}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: '#a78bfa',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.16)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
            aria-label="Toggle language"
          >
            <span style={{ fontSize: 14 }}>🌐</span>
            <span>{lang === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span className="admin-chip">{t.auth.adminBadge}</span>
        </div>
        <div className="auth-logo">
          <div className="logo-circle admin-logo">🛡️</div>
          <h1 style={{ color: 'var(--text-primary)' }}>{t.auth.adminTitle}</h1>
          <p>{t.auth.adminSubtitle}</p>
        </div>
        <div className="alert alert-warning" style={{ fontSize: 12 }}>{t.auth.adminWarning}</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.auth.adminEmail}</label>
            <input className="form-input" type="email" placeholder={t.auth.adminEmailPlaceholder}
              value={form.email} onChange={set('email')} required autoComplete="email"
              style={{ borderColor: 'rgba(124,58,237,0.25)' }} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.auth.adminPassword}</label>
            <div className="password-wrapper">
              <input className="form-input" type={showPassword ? 'text' : 'password'}
                placeholder={t.auth.passwordPlaceholder} value={form.password} onChange={set('password')}
                required autoComplete="current-password" style={{ borderColor: 'rgba(124,58,237,0.25)' }} />
              <button type="button" className="password-eye" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 4,
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff' }}
            type="submit" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff' }} /> {t.auth.adminVerifying}</> : `🔐 ${t.auth.adminSignIn}`}
          </button>
        </form>
        <div className="auth-divider" />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {t.auth.notAdmin}{' '}
          <Link to="/login" style={{ color: 'var(--cyan)' }}>{t.auth.userLogin}</Link>
        </div>
      </div>
    </div>
  );
}
