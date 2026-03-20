import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import toast from 'react-hot-toast';

export default function UserLoginPage() {
  const { loginUser } = useAuth();
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
      await loginUser(form.email, form.password);
      toast.success(t.auth.welcomeBack);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t.auth.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            type="button"
            onClick={toggleLang}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)',
              borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: 'var(--cyan)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.16)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.08)'}
            aria-label="Toggle language"
          >
            <span style={{ fontSize: 14 }}>🌐</span>
            <span>{lang === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>
        </div>
        <div className="auth-logo">
          <div className="logo-circle user-logo">💧</div>
          <h1>AquaTrack Pro</h1>
          <p>{t.auth.signInTo}</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.auth.emailAddress}</label>
            <input className="form-input" type="email" placeholder={t.auth.emailPlaceholder}
              value={form.email} onChange={set('email')} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label">{t.auth.password}</label>
            <div className="password-wrapper">
              <input className="form-input" type={showPassword ? 'text' : 'password'}
                placeholder={t.auth.passwordPlaceholder} value={form.password}
                onChange={set('password')} required autoComplete="current-password" />
              <button type="button" className="password-eye" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            type="submit" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {t.auth.signingIn}</> : `🔑 ${t.auth.signInBtn}`}
          </button>
        </form>
        <div className="auth-divider" />
        <div className="auth-footer">
          {t.auth.noAccount}{' '}
          <Link to="/signup" style={{ color: 'var(--cyan)', fontWeight: 600 }}>{t.auth.createOne}</Link>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          <Link to="/admin/login" style={{ color: '#a78bfa' }}>{t.auth.adminLink}</Link>
        </div>
      </div>
    </div>
  );
}
