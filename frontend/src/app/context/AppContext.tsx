import { createContext, useContext } from 'react';
import type { AuthUser } from '../auth/client';

interface AppContextValue {
  onSignOut: () => void;
  currentUser: AuthUser | null;
}

export const AppContext = createContext<AppContextValue>({
  onSignOut: () => {},
  currentUser: null,
});
export const useAppContext = () => useContext(AppContext);
