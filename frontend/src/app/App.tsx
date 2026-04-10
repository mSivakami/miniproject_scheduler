import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthPage } from './pages/AuthPage';
import { getStoredToken, apiMe, signOut, type AuthUser } from './auth/client';
import { useStore } from './store/useStore';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { AppContext } from './context/AppContext';

type AuthStatus = 'checking' | 'signed-out' | 'signed-in';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const { bootstrap, isBootstrapped, resetAllData } = useStore();

  // Check existing token on mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthStatus('signed-out');
      return;
    }
    // Validate token is still good
    apiMe()
      .then((user) => {
        setCurrentUser(user);
        setAuthStatus('signed-in');
      })
      .catch(() => {
        signOut();
        setCurrentUser(null);
        setAuthStatus('signed-out');
      });
  }, []);

  // Bootstrap once signed in
  useEffect(() => {
    if (authStatus === 'signed-in' && !isBootstrapped) {
      bootstrap().catch(err => {
        console.warn('[bootstrap]', err);
        toast.error('Could not load data from server. Check backend is running.');
      });
    }
  }, [authStatus, isBootstrapped]);

  const handleSignedIn = async () => {
    const user = await apiMe();
    setCurrentUser(user);
    setAuthStatus('signed-in');
  };

  const handleSignOut = () => {
    signOut();
    resetAllData();
    setCurrentUser(null);
    setAuthStatus('signed-out');
  };

  if (authStatus === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'signed-out') {
    return (
      <>
        <Toaster position="bottom-right" richColors />
        <AuthPage onSignedIn={handleSignedIn} />
      </>
    );
  }

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <AppContext.Provider value={{ onSignOut: handleSignOut, currentUser }}>
        <RouterProvider router={router} />
      </AppContext.Provider>
    </>
  );
}
