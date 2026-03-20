import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import toast from 'react-hot-toast';

export default function UserSignupPage() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const strength = (pw) => {
    if (!pw) return null;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };

  const pwStrength = strength(form.password);
  const strengthLabels = ['', t.auth.passwordWeak, t.auth.passwordFair, t.auth.passwordGood, t.auth.passwordStrong];
  const strengthColors = ['', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError(t.auth.passwordMismatch); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success(t.auth.accountCreated);
      navigate('/upload');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || t.auth.registrationFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-circle user-logo">💧</div>
          <h1>{t.auth.createAccount}</h1>
          <p>{t.auth.joinToday}</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.auth.fullName}</label>
            <input className="form-input" type="text" placeholder={t.auth.fullNamePlaceholder}
              value={form.name} onChange={set('name')} required autoComplete="name" />
          </div>
          <div className="form-group">
            <label className="form-label">{t.auth.emailAddress}</label>
            <input className="form-input" type="email" placeholder={t.auth.emailPlaceholder}
              value={form.email} onChange={set('email')} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label">{t.auth.password}</label>
            <div className="password-wrapper">
              <input className="form-input" type={showPassword ? 'text' : 'password'}
                placeholder={t.auth.passwordMin} value={form.password} onChange={set('password')}
                required autoComplete="new-password" />
              <button type="button" className="password-eye" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {form.password && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2,
                      background: pwStrength >= i ? strengthColors[pwStrength] : 'var(--bg-hover)', transition: 'background .2s' }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: strengthColors[pwStrength] }}>{strengthLabels[pwStrength]}</span>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t.auth.confirmPassword}</label>
            <div className="password-wrapper">
              <input className="form-input" type={showConfirm ? 'text' : 'password'}
                placeholder={t.auth.repeatPassword} value={form.confirm} onChange={set('confirm')}
                required autoComplete="new-password"
                style={form.confirm && form.confirm !== form.password ? { borderColor: 'var(--red)' } : {}} />
              <button type="button" className="password-eye" onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? t.auth.hidePassword : t.auth.showPassword}>
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
            {form.confirm && form.confirm !== form.password && (
              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{t.auth.passwordMismatch}</div>
            )}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            type="submit" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {t.auth.creating}</> : `🚀 ${t.auth.createAccountBtn}`}
          </button>
        </form>
        <div className="auth-divider" />
        <div className="auth-footer">
          {t.auth.alreadyAccount}{' '}
          <Link to="/login" style={{ color: 'var(--cyan)', fontWeight: 600 }}>
            {t.auth.signInBtn} →
          </Link>
        </div>
      </div>
    </div>
  );
}
