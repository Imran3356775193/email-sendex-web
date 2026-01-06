import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load stored user (if any). Do not auto-create demo user.
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        // Ensure axios sends Authorization header for API calls
        if (parsed.token) axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;
      } catch (err) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      // Handle non-JSON or error responses gracefully
      const contentType = res.headers.get('content-type') || '';
      let json;
      if (contentType.includes('application/json')) {
        json = await res.json();
      } else {
        const text = await res.text();
        // Strip HTML if any
        const stripped = text.replace(/<[^>]*>/g, '').trim();
        throw new Error(stripped || `Unexpected response (status ${res.status})`);
      }

      if (!res.ok) throw new Error(json.error || 'Login failed');

      const stored = { ...json.user, token: json.token };
      setUser(stored);
      // Set axios default Authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${stored.token}`;
      localStorage.setItem('user', JSON.stringify(stored));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    // Clear axios default Authorization header
    delete axios.defaults.headers.common['Authorization'];
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type') || '';
      let json;
      if (contentType.includes('application/json')) {
        json = await res.json();
      } else {
        const text = await res.text();
        const stripped = text.replace(/<[^>]*>/g, '').trim();
        throw new Error(stripped || `Unexpected response (status ${res.status})`);
      }

      if (!res.ok) throw new Error(json.error || 'Registration failed');

      const stored = { ...json.user, token: json.token };
      setUser(stored);
      // Set axios default Authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${stored.token}`;
      localStorage.setItem('user', JSON.stringify(stored));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};