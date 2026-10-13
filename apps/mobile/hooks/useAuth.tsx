import React, { createContext, useContext, useState, useEffect } from 'react';
import { Storage } from '../lib/storage';
import { fetchApi } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string | { name: string };
  centreName?: string;
  avatar?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  role: null,
  isLoading: true,
  login: async () => ({ id: '', email: '' }),
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getNormalizedRole = (u: UserProfile | null): string | null => {
    if (!u || !u.role) return null;
    const raw = typeof u.role === 'object' ? u.role.name : String(u.role);
    return raw.toUpperCase().replace(/\s+/g, '_');
  };

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedToken = await Storage.getToken();
        const storedUser = await Storage.getUser();
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
        }
      } catch (err) {
        console.error('Failed to load initial auth state', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const data = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const authToken = data.access_token || data.token;
    const authUser = data.user;

    if (!authToken || !authUser) {
      throw new Error('Invalid response from login server');
    }

    await Storage.saveToken(authToken);
    await Storage.saveUser(authUser);

    setToken(authToken);
    setUser(authUser);

    return authUser;
  };

  const logout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      await Storage.clearAuth();
      setToken(null);
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const data = await fetchApi('/profile');
      if (data) {
        await Storage.saveUser(data);
        setUser(data);
      }
    } catch (e) {
      console.error('Failed to refresh profile', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: getNormalizedRole(user),
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
