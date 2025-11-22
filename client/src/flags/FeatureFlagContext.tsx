import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

type FeatureFlagMap = Record<string, boolean>;

interface FeatureFlagContextValue {
  flags: FeatureFlagMap;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isEnabled: (key: string) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(undefined);

export const FeatureFlagProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [flags, setFlags] = useState<FeatureFlagMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data } = await api.get<{ flags: FeatureFlagMap }>('/flags');
      setFlags(data.flags ?? {});
    } catch (err) {
      console.error('Feature flag fetch failed:', err);
      setError('Unable to load feature flags');
      setFlags({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void fetchFlags();
  }, [authLoading, user?.id, fetchFlags]);

  const value = useMemo<FeatureFlagContextValue>(
    () => ({
      flags,
      isLoading,
      error,
      refresh: fetchFlags,
      isEnabled: (key: string) => Boolean(flags[key]),
    }),
    [flags, isLoading, error, fetchFlags]
  );

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};

