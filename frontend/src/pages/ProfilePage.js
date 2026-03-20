import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

/* ── Helpers ─────────────────────────────────────────────── */
const API_BASE = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function avatarSrc(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

function PasswordStrength({ password }) {
  let strength = 0;
  if (password.length >= 8)        strength++;
  if (/[A-Z]/.test(password))      strength++;
  if (/[0-9]/.test(password))      strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  if (!password) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= strength ? colors[strength] : 'rgba(255,255,255,0.1)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: colors[strength] }}>{labels[strength]}</span>
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────── */
function Section({ title, icon, children, onSave, saving, saveLabel = 'Save Changes' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(99,179,237,0.12)',
      borderRadius: 14,
      padding: '28px 32px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{title}</h3>
      </div>
      {children}
      {onSave && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 28px',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Input helper ────────────────────────────────────────── */
function Field({ label, type = 'text', value, onChange, placeholder, hint, extra }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(99,179,237,0.2)',
            borderRadius: 8,
            color: '#e2e8f0',
            padding: isPassword ? '10px 42px 10px 14px' : '10px 14px',
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16,
            }}
            title={show ? 'Hide' : 'Show'}
          >
            {show ? '🙈' : '👁️'}
          </button>
        )}
      </div>
      {hint && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{hint}</div>}
      {extra}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main ProfilePage
══════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef(null);

  // Profile data loaded from server
  const [profile, setProfile] = useState(null);

  // Name
  const [name, setName]       = useState('');
  const [savingName, setSavingName] = useState(false);

  // Email
  const [email, setEmail]         = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password
  const [curPass, setCurPass]     = useState('');
  const [newPass, setNewPass]     = useState('');
  const [conPass, setConPass]     = useState('');
  const [savingPass, setSavingPass] = useState(false);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile]       = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  /* Load profile */
  useEffect(() => {
    api.get('/profile').then(({ data }) => {
      setProfile(data.user);
      setName(data.user.name || '');
      setEmail(data.user.email || '');
      setAvatarPreview(avatarSrc(data.user.avatarUrl));
    }).catch(() => {
      // fallback to auth context
      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
      }
    });
  }, [user]);

  /* ── Avatar handlers ──────────────────────────────────── */
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) { toast.error('Please select an image first'); return; }
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('avatar', avatarFile);
      const { data } = await api.post('/profile/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Profile picture updated!');
      setAvatarFile(null);
      setAvatarPreview(avatarSrc(data.avatarUrl));
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remove your profile picture?')) return;
    try {
      await api.delete('/profile/avatar');
      setAvatarPreview(null);
      setAvatarFile(null);
      toast.success('Profile picture removed');
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove picture');
    }
  };

  /* ── Name save ────────────────────────────────────────── */
  const handleSaveName = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSavingName(true);
    try {
      const { data } = await api.patch('/profile/name', { name: name.trim() });
      toast.success(data.message || 'Name updated!');
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update name');
    } finally {
      setSavingName(false);
    }
  };

  /* ── Email save ───────────────────────────────────────── */
  const handleSaveEmail = async () => {
    if (!email.endsWith('@gmail.com')) { toast.error('Only Gmail addresses are accepted'); return; }
    if (!emailPass) { toast.error('Enter your current password to confirm'); return; }
    setSavingEmail(true);
    try {
      const { data } = await api.patch('/profile/email', { email, currentPassword: emailPass });
      toast.success(data.message || 'Email updated!');
      setEmailPass('');
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update email');
    } finally {
      setSavingEmail(false);
    }
  };

  /* ── Password save ────────────────────────────────────── */
  const handleSavePassword = async () => {
    if (!curPass || !newPass || !conPass) { toast.error('All password fields are required'); return; }
    if (newPass !== conPass) { toast.error('New passwords do not match'); return; }
    if (newPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(newPass)) { toast.error('Include at least one uppercase letter'); return; }
    if (!/[0-9]/.test(newPass)) { toast.error('Include at least one number'); return; }
    setSavingPass(true);
    try {
      const { data } = await api.patch('/profile/password', {
        currentPassword: curPass,
        newPassword: newPass,
        confirmPassword: conPass,
      });
      toast.success(data.message || 'Password changed!');
      setCurPass(''); setNewPass(''); setConPass('');
    } catch (err) {
      // Handle validation array or single error
      const errs = err.response?.data?.errors;
      if (errs && errs.length) toast.error(errs[0].msg);
      else toast.error(err.response?.data?.error || 'Could not change password');
    } finally {
      setSavingPass(false);
    }
  };

  /* ── Render ───────────────────────────────────────────── */
  const initials = (name || user?.name || 'U')[0]?.toUpperCase();

  return (
    <div style={{ padding: '32px 36px', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>👤 Profile Settings</h1>
        <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>
          Manage your account information and security settings.
        </p>
      </div>

      {/* ── Profile Picture ── */}
      <Section icon="🖼️" title="Profile Picture">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          {/* Avatar display */}
          <div style={{ position: 'relative' }}>
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                style={{
                  width: 96, height: 96, borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid rgba(99,179,237,0.4)',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 700, color: '#fff',
                border: '3px solid rgba(99,179,237,0.4)',
              }}>
                {initials}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ flex: 1 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.4)',
                  color: '#93c5fd',
                  borderRadius: 8, padding: '8px 18px',
                  fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
              >
                📁 Choose Image
              </button>
              <button
                onClick={handleAvatarUpload}
                disabled={!avatarFile || uploadingAvatar}
                style={{
                  background: avatarFile ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : 'rgba(255,255,255,0.05)',
                  border: 'none', color: avatarFile ? '#fff' : '#64748b',
                  borderRadius: 8, padding: '8px 18px',
                  fontSize: 13, cursor: avatarFile ? 'pointer' : 'not-allowed',
                  fontWeight: 600, opacity: uploadingAvatar ? 0.7 : 1,
                }}
              >
                {uploadingAvatar ? 'Uploading…' : '⬆️ Upload'}
              </button>
              {(avatarPreview && !avatarFile) && (
                <button
                  onClick={handleRemoveAvatar}
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5', borderRadius: 8, padding: '8px 18px',
                    fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  🗑️ Remove
                </button>
              )}
            </div>
            {avatarFile && (
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                Selected: <strong style={{ color: '#e2e8f0' }}>{avatarFile.name}</strong> — click Upload to save.
              </p>
            )}
            <p style={{ margin: 0, fontSize: 11, color: '#64748b', marginTop: 4 }}>
              JPG, PNG, WebP or GIF · Max 5 MB
            </p>
          </div>
        </div>
      </Section>

      {/* ── Update Name ── */}
      <Section icon="✏️" title="Update Name" onSave={handleSaveName} saving={savingName}>
        <Field
          label="Full Name"
          value={name}
          onChange={setName}
          placeholder="Your full name"
          hint="This is how your name appears across the platform."
        />
      </Section>

      {/* ── Update Email ── */}
      <Section icon="📧" title="Update Email (Gmail only)" onSave={handleSaveEmail} saving={savingEmail}>
        <Field
          label="New Gmail Address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@gmail.com"
          hint="Only @gmail.com addresses are accepted."
        />
        <Field
          label="Current Password (required to confirm)"
          type="password"
          value={emailPass}
          onChange={setEmailPass}
          placeholder="••••••••"
        />
      </Section>

      {/* ── Change Password ── */}
      <Section icon="🔒" title="Change Password" onSave={handleSavePassword} saving={savingPass} saveLabel="Change Password">
        <Field
          label="Current Password"
          type="password"
          value={curPass}
          onChange={setCurPass}
          placeholder="••••••••"
        />
        <Field
          label="New Password"
          type="password"
          value={newPass}
          onChange={setNewPass}
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          extra={<PasswordStrength password={newPass} />}
        />
        <Field
          label="Confirm New Password"
          type="password"
          value={conPass}
          onChange={setConPass}
          placeholder="Repeat new password"
        />
        {conPass && newPass !== conPass && (
          <p style={{ margin: '-8px 0 12px', fontSize: 12, color: '#ef4444' }}>
            ⚠️ Passwords do not match
          </p>
        )}
      </Section>

      {/* Account info */}
      {profile && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(99,179,237,0.08)',
          borderRadius: 12, padding: '18px 24px',
          display: 'flex', gap: 32, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Account Role</div>
            <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500, textTransform: 'capitalize' }}>{profile.role}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Member Since</div>
            <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>
              {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
