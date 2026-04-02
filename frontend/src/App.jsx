import React, { useState, useEffect } from 'react';

const API_BASE = '';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState('login'); // login, dashboard

  // 1. Check Health & Me on Mount
  useEffect(() => {
    checkHealth();
    if (token) {
      fetchMe();
    }
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const json = await res.json();
      setHealth(json);
    } catch (e) {
      setHealth({ status: 'error', service: 'Backend unreachable' });
    }
  };

  const fetchMe = async (t) => {
    const activeToken = t || token;
    if (!activeToken) return;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const json = await res.json();
        setUser(json);
        setView('dashboard');
        fetchData(activeToken);
      } else {
        logout();
      }
    } catch (e) {
      logout();
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = e.target;
    const username = form.username.value;
    const password = form.password.value;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Invalid credentials');
        throw new Error('Login failed');
      }

      const { access_token } = await res.json();
      localStorage.setItem('token', access_token);
      setToken(access_token);
      fetchMe(access_token); // Pass the fresh token directly
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (t) => {
    try {
      const res = await fetch(`${API_BASE}/api/data`, {
        headers: { 'Authorization': `Bearer ${t || token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Fetch data error:", e);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setData(null);
    setView('login');
  };

  if (view === 'login') {
    return (
      <div className="login-container fade-in">
        <div className="card glass login-card">
          <h1>AutoScheduler</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Minimal API Verification Client
          </p>
          
          <form onSubmit={login}>
            <div className="input-group">
              <label>Username</label>
              <input name="username" type="text" defaultValue="admin" required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input name="password" type="password" defaultValue="admin123" required />
            </div>
            
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
            
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login to System'}
            </button>
          </form>

          <div style={{ marginTop: '2rem' }} className="status-indicator">
            <div className={`dot ${health?.status === 'ok' ? 'green' : 'red'}`}></div>
            <span>Backend: {health?.service} ({health?.status || 'offline'})</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <header className="app-header">
        <div>
          <h1>Dashboard</h1>
          <h2>Institution: {data?.institution?.name || 'Loading...'}</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="secondary" onClick={() => fetchData()}>Refresh</button>
          <button className="secondary" style={{ color: 'var(--danger)' }} onClick={logout}>Logout</button>
        </div>
      </header>

      <section className="card glass">
        <h3>Teachers ({data?.teachers?.length || 0})</h3>
        <div className="data-grid" style={{ marginTop: '1rem' }}>
          {data?.teachers?.map(t => (
            <div key={t.id} className="item-card fade-in">
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>ID: {t.id}</div>
              <div style={{ marginTop: '0.5rem' }}>
                <span className="badge">Max {t.max_per_day}/day</span>
                <span className="badge">Max {t.max_per_week}/week</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card glass">
        <h3>Classrooms ({data?.classrooms?.length || 0})</h3>
        <div className="data-grid" style={{ marginTop: '1rem' }}>
          {data?.classrooms?.map(c => (
            <div key={c.id} className="item-card fade-in">
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Capacity: {c.capacity}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card glass">
        <h3>Subjects ({data?.subjects?.length || 0})</h3>
        <div className="data-grid" style={{ marginTop: '1rem' }}>
          {data?.subjects?.slice(0, 10).map(s => (
            <div key={s.id} className="item-card fade-in">
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ marginTop: '0.5rem' }}>
                {s.is_difficult && <span className="badge" style={{ background: 'var(--danger)' }}>Difficult</span>}
                {s.is_lab && <span className="badge" style={{ background: 'var(--success)' }}>Lab</span>}
                <span className="badge">P{s.priority}</span>
              </div>
            </div>
          ))}
          {data?.subjects?.length > 10 && <div className="item-card" style={{ opacity: 0.5 }}>+ {data.subjects.length - 10} more subjects</div>}
        </div>
      </section>

      <section className="card glass">
        <h3 style={{ marginBottom: '1rem' }}>Raw Data Snippet</h3>
        <pre>{JSON.stringify(data?.institution, null, 2)}</pre>
      </section>
    </div>
  );
};

export default App;
