import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { realApi as api } from '../services/realApi';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    try {
      await api.register(username, password);
      const token = await api.login(username, password);
      login(username, token);
      navigate('/dashboard');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

      <div className="auth-card fade-in">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', marginBottom: 16, fontSize: 28 }}>🛸</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, background: 'linear-gradient(135deg, #00d4ff, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 }}>DroneOS</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Create your operator account</p>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Username</label>
            <input id="reg-username" className="input" type="text" placeholder="Choose a username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input id="reg-password" className="input" type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="label">Confirm Password</label>
            <input id="reg-confirm" className="input" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button id="reg-submit" className="btn btn-success" type="submit" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 8 }}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating account...</> : '🚀 Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
