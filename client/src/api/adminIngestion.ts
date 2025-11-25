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


