import type { DwigoEnvelope } from '@/lib/dwigo';
import { dwigo } from '@/lib/dwigo';

const ADMIN_HEADER = 'x-admin-token';
const adminToken = import.meta.env.VITE_ADMIN_API_TOKEN ?? '';

const buildConfig = () =>
  adminToken
    ? {
        headers: {
          [ADMIN_HEADER]: adminToken,
        },
      }
    : {};

export interface IngestedDealRow {
  id: number;
  job_id: number | null;
  merchant_alias: string | null;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown> | null;
  status: string;
  matched_merchant_id: number | null;
  confidence: number | null;
  created_at: string;
  job_source?: string | null;
  job_scope?: string | null;
  job_started_at?: string | null;
  job_finished_at?: string | null;
}

interface PendingResponse {
  data: IngestedDealRow[];
  error: null;
  meta: { total: number };
}

interface PromoteResponse {
  data: { fetched: number; promoted: number; errors: number };
}

interface RejectResponse {
  data: { updated: number };
}

export const fetchPendingIngestionRows = (limit = 50) =>
  dwigo.get<IngestedDealRow[]>(`/admin/ingestion/pending?limit=${limit}`, buildConfig());

export const promoteIngestionRows = (ids: number[]) =>
  dwigo.post<{ ids: number[] }, PromoteResponse['data']>(
    '/admin/ingestion/promote',
    { ids },
    buildConfig()
  );

export const rejectIngestionRows = (ids: number[]) =>
  dwigo.post<{ ids: number[] }, RejectResponse['data']>(
    '/admin/ingestion/reject',
    { ids },
    buildConfig()
  );

export const seedIngestionJob = () =>
  dwigo.post<never, { message: string; dealCount: number }>(
    '/admin/ingestion/seed',
    undefined,
    buildConfig()
  );

export const seedMidMichiganDeals = () =>
  dwigo.post<never, { message: string; dealCount: number; jobId: string; stats: unknown }>(
    '/admin/ingestion/seed-mid-michigan',
    undefined,
    buildConfig()
  );

export interface ManualDealEntry {
  merchantAlias: string;
  title: string;
  description?: string;
  category: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  startDate?: string;
  endDate?: string;
  price?: string;
  discountPercentage?: string;
  sourceUrl?: string;
  confidence?: number;
}

export const submitManualDeal = (deal: ManualDealEntry) =>
  dwigo.post<ManualDealEntry, { message: string; dealCount: number; jobId: string; stats: unknown }>(
    '/admin/ingestion/manual-entry',
    deal,
    buildConfig()
  );

/** Places-verified merchants → website HTML → strict LLM extraction (real offers only). */
export const fetchDealsWithAI = (options?: { categories?: string[]; maxDealsPerLocation?: number }) =>
  dwigo.post<{ categories?: string[]; maxDealsPerLocation?: number }, { message: string; dealCount: number; jobId: string; stats: unknown }>(
    '/admin/ai/fetch-deals',
    options || {},
    buildConfig()
  );

/** Demo / investor deck: LLM-invented offers for real merchant names (synthetic — verify before promote). */
export const fetchDealsWithAIDemo = (options?: { categories?: string[]; maxDealsPerLocation?: number }) =>
  dwigo.post<{ categories?: string[]; maxDealsPerLocation?: number }, { message: string; dealCount: number; jobId: string; stats: unknown }>(
    '/admin/ai/fetch-deals-demo',
    options || {},
    buildConfig()
  );

export const scrapeDealsFromWeb = () =>
  dwigo.post<never, { message: string; sourcesScraped: number; dealsExtracted: number; dealsIngested: number; jobId: string; stats: unknown }>(
    '/admin/ai/scrape-deals',
    undefined,
    buildConfig()
  );

export interface DiscoverDiningScrapePayload {
  searchQuery?: string;
  /** Override multi-query rotation (e.g. ["restaurant", "cafe", "brewery"]) */
  searchQueries?: string[];
  nearText?: string;
  maxPlaces?: number;
  maxItemsPerSite?: number;
  maxDealsPerVenue?: number;
  maxFollowUpUrls?: number;
  delayBetweenVenuesMs?: number;
  /** Server waits for full run in one HTTP request (curl only; browsers time out). */
  wait?: boolean;
}

export interface DiscoverDiningResult {
  message: string;
  success?: boolean;
  venuesFound?: number;
  venuesScraped?: number;
  dealsExtracted?: number;
  dealsIngested?: number;
  jobId?: string | number;
  stats?: unknown;
  results?: Array<{ name: string; website: string; dealsFound: number; success?: boolean; error?: string | null }>;
  error?: string;
}

export interface DiscoverDiningJobStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  message?: string;
  error?: string;
  createdAt?: number;
  startedAt?: number;
  finishedAt?: number;
  result?: DiscoverDiningResult;
}

export const getDiscoverDiningJobStatus = (jobId: string) =>
  dwigo.get<DiscoverDiningJobStatus>(`/admin/ai/discover-dining-scrape/job/${jobId}`, buildConfig());

const DISCOVER_POLL_MS = 4000;
const DISCOVER_MAX_POLLS = 900; // ~60 min at 4s

/**
 * Starts async discovery on the server (202), then polls until completed/failed.
 * Avoids axios "Network Error" from long single HTTP requests.
 */
export async function discoverDiningFromPlaces(
  payload: DiscoverDiningScrapePayload = {}
): Promise<DwigoEnvelope<DiscoverDiningResult>> {
  const env = await dwigo.post<
    DiscoverDiningScrapePayload,
    { jobId?: string; message?: string; status?: string } & Partial<DiscoverDiningResult>
  >('/admin/ai/discover-dining-scrape', payload, buildConfig());

  const d = env.data;
  if (d && typeof d === 'object' && typeof d.jobId === 'string' && d.jobId.length > 0) {
    const jobId = d.jobId;
    for (let i = 0; i < DISCOVER_MAX_POLLS; i += 1) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, DISCOVER_POLL_MS));
      }
      const st = await getDiscoverDiningJobStatus(jobId);
      const row = st.data;
      if (!row) continue;
      if (row.status === 'completed' && row.result) {
        const r = row.result;
        return {
          data: {
            message: row.message ?? r.error ?? 'Discovery finished',
            ...r,
          },
          error: null,
          meta: {},
        };
      }
      if (row.status === 'failed') {
        throw new Error(row.error || row.message || 'Discovery job failed');
      }
    }
    throw new Error(
      'Stopped polling after ~60m (job may still be running). Refresh pending deals and check server logs.'
    );
  }

  return env as DwigoEnvelope<DiscoverDiningResult>;
}

export const uploadCSV = (file: File): Promise<DwigoEnvelope<{ message: string; dealCount: number; jobId: string; stats: unknown }>> => {
  const formData = new FormData();
  formData.append('csv', file);

  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  
  // Don't set Content-Type header - browser will set it with boundary for FormData
  const headers: HeadersInit = {
    [ADMIN_HEADER]: adminToken,
  };

  return fetch(`${apiUrl}/admin/ingestion/upload-csv`, {
    method: 'POST',
    headers,
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      let errorMessage = 'Failed to upload CSV';
      try {
        const error = await res.json();
        errorMessage = error.error?.message || errorMessage;
      } catch {
        // If response isn't JSON, use status text
        errorMessage = res.statusText || `Server error (${res.status})`;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  }).catch((error) => {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Connection failed. Please check your internet connection or VPN.');
    }
    throw error;
  });
};


