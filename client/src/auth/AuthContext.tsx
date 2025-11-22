import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import api, { setApiAuthToken } from '@/api/client';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

const TOKEN_KEY = 'dwigo_auth_token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialise = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        setApiAuthToken(storedToken);
        const { data } = await api.get<{ user: User }>('/auth/me');
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        setApiAuthToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void initialise();
  }, []);

  const handleAuthSuccess = (token: string, nextUser: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    setApiAuthToken(token);
    setUser(nextUser);
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    handleAuthSuccess(data.token, data.user);
  };

  const register = async (payload: RegisterPayload) => {
    const { data } = await api.post<AuthResponse>('/auth/register', payload);
    handleAuthSuccess(data.token, data.user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setApiAuthToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

