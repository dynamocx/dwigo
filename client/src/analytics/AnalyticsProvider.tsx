import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';

import api from '@/api/client';

const ANONYMOUS_ID_STORAGE_KEY = 'dwigo_anon_id';

const generateAnonymousId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback UUID-ish generator
  return 'anon-' + Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 11);
};

const getStoredAnonymousId = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const existing = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const newId = generateAnonymousId();
  window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, newId);
  return newId;
};

export interface TrackEventInput {
  eventType: string;
  entityType?: string;
  entityId?: string | number;
  metadata?: Record<string, unknown>;
  source?: string;
  deviceId?: string;
  occurredAt?: Date | string;
}

interface AnalyticsContextValue {
  anonymousId: string;
  trackEvent: (input: TrackEventInput) => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined);

export const AnalyticsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [anonymousId, setAnonymousId] = useState<string>(() => getStoredAnonymousId());

  useEffect(() => {
    if (!anonymousId && typeof window !== 'undefined') {
      const nextId = getStoredAnonymousId();
      setAnonymousId(nextId);
    }
  }, [anonymousId]);

  const trackEvent = useCallback(
    async ({ eventType, entityType, entityId, metadata, source, deviceId, occurredAt }: TrackEventInput) => {
      if (!eventType) {
        throw new Error('eventType is required when tracking analytics events');
      }

      const payload = {
        eventType,
        entityType: entityType ?? null,
        entityId: entityId != null ? String(entityId) : null,
        metadata: metadata ?? null,
        source: source ?? 'app',
        deviceId: deviceId ?? null,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        anonymousId: anonymousId || getStoredAnonymousId(),
      };

      try {
        await api.post('/events', payload);
      } catch (error) {
        console.error('Failed to track analytics event', payload, error);
      }
    },
    [anonymousId]
  );

  const value = useMemo(
    () => ({
      anonymousId,
      trackEvent,
    }),
    [anonymousId, trackEvent]
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
};

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

