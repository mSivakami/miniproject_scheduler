import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const { login, checkHealth, health, token } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkHealth();
    if (token) navigate('/dashboard');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo">
          <h1>⊞ AutoScheduler</h1>
          <p>Genetic Algorithm · Timetable Engine</p>
        </div>

        {error && <div className="alert error mb-2">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> Signing in…</>
            ) : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <div className="health-badge" style={{ justifyContent: 'center' }}>
            <span className={`dot ${health?.status === 'ok' ? 'green' : 'red'}`}></span>
            <span>
              {health?.status === 'ok'
                ? `${health.service} · online`
                : health?.status === 'error'
                ? 'Backend unreachable'
                : 'Checking backend…'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
