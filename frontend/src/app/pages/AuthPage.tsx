import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';

import { apiAuthStatus, apiLogin, apiRegister, apiSetup, setStoredToken } from '../auth/client';

interface AuthPageProps {
  onSignedIn: () => void | Promise<void>;
}

type AuthMode = 'checking' | 'setup' | 'login' | 'register';

export function AuthPage({ onSignedIn }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiAuthStatus()
      .then(({ setup_required }) => {
        setMode(setup_required ? 'setup' : 'login');
      })
      .catch(() => {
        setError('Cannot reach the backend server. Make sure it is running.');
        setMode('login');
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'checking') return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'setup') {
        await apiSetup(username.trim(), password);
        setSuccess('Account created. Sign in with the account you just created.');
        setPassword('');
        setMode('login');
        return;
      }

      if (mode === 'register') {
        await apiRegister(username.trim(), password);
        setSuccess('Account created. Sign in with the account you just created.');
        setPassword('');
        setMode('login');
        return;
      }

      const response = await apiLogin(username.trim(), password);
      setStoredToken(response.access_token);
      await onSignedIn();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'setup'
    ? 'Create your account'
    : mode === 'register'
      ? 'Create account'
      : 'Sign in to your account';

  const subtitle = mode === 'setup'
    ? 'First-time setup - create the first account. You will sign in after it is created.'
    : mode === 'register'
      ? 'Create another sign-in account. You will sign in after it is created.'
      : '';

  const submitLabel = loading
    ? 'Please wait...'
    : mode === 'setup'
      ? 'Create your account'
      : mode === 'register'
        ? 'Create account'
        : 'Sign in';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 rounded-xl bg-muted mb-3">
            <GraduationCap className="w-7 h-7 text-foreground" />
          </div>
          <h1 className="text-lg font-semibold">AutoScheduler</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Genetic Algorithm Timetable Scheduler</p>
        </div>

        <div className="bg-card rounded-xl p-8 border border-border shadow-sm">
          {mode === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Connecting to backend...</p>
            </div>
          )}

          {(mode === 'setup' || mode === 'login' || mode === 'register') && (
            <>
              <h2 className="text-base font-semibold mb-1">{title}</h2>
              {subtitle ? (
                <p className="text-xs text-muted-foreground mb-5">{subtitle}</p>
              ) : (
                <div className="mb-5" />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3 py-2 rounded-md border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring transition"
                    placeholder="username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-md border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring transition"
                    placeholder="........"
                  />
                </div>

                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
                )}

                {success && (
                  <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-md border border-green-200">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-md bg-foreground text-background text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
                >
                  {submitLabel}
                </button>
              </form>

              {mode === 'login' && (
                <p className="text-center text-xs text-muted-foreground mt-4">
                  Need an account?{' '}
                  <button onClick={() => { setSuccess(''); setMode('register'); }} className="text-foreground font-medium hover:underline">
                    Create account
                  </button>
                </p>
              )}

              {mode === 'register' && (
                <p className="text-center text-xs text-muted-foreground mt-4">
                  Already have an account?{' '}
                  <button onClick={() => { setSuccess(''); setMode('login'); }} className="text-foreground font-medium hover:underline">
                    Sign in
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
