import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { realApi as api } from '../services/realApi';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = await api.login(username, password);
      login(username, token);
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Animated grid background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

      <div className="auth-card fade-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', marginBottom: 16, fontSize: 28 }}>🛸</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, background: 'linear-gradient(135deg, #00d4ff, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 }}>DroneOS</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Autonomous Fleet Command Center</p>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Username</label>
            <input id="login-username" className="input" type="text" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input id="login-password" className="input" type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button id="login-submit" className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 8 }}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Authenticating...</> : '🔐 Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600 }}>
            Create one
          </Link>
        </div>

        <div className="divider" style={{ marginTop: 24 }} />
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
          Demo: enter any username + password
        </p>
      </div>
    </div>
  );
}
