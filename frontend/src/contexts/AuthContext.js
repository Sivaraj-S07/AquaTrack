import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Re-hydrate session from localStorage
  useEffect(() => {
    const token  = localStorage.getItem('at_token');
    const stored = localStorage.getItem('at_user');
    if (token && stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch (_) {}
    }
    setLoading(false);
  }, []);

  // User login
  const loginUser = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('at_token', data.token);
    localStorage.setItem('at_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  // Admin login
  const loginAdmin = useCallback(async (email, password) => {
    const { data } = await api.post('/admin/auth/login', { email, password });
    localStorage.setItem('at_token', data.token);
    localStorage.setItem('at_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  // User register
  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('at_token', data.token);
    localStorage.setItem('at_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('at_token');
    localStorage.removeItem('at_user');
    setUser(null);
  }, []);

  // Update user state (e.g., after CSV upload)
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      const updated = data.user;
      localStorage.setItem('at_user', JSON.stringify(updated));
      setUser(updated);
      return updated;
    } catch (_) {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, loginAdmin, register, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
