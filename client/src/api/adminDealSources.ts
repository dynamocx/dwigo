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

export interface DealSourceCatalogRow {
  id: string;
  merchantName: string;
  city: string;
  state: string;
  type: string;
  category: string;
  url: string;
  fetchMode?: string;
  selectors?: Record<string, string>;
  keywords?: string[];
  enabled?: boolean;
  priority?: number;
}

export interface DealSourcesCatalogPayload {
  sources: DealSourceCatalogRow[];
  categoryFilter: string | null;
  configHint: string;
}

export const fetchDealSourcesCatalog = () =>
  dwigo.get<DealSourcesCatalogPayload>('/admin/deal-sources', buildConfig());

export type DealSourcesCatalogEnvelope = DwigoEnvelope<DealSourcesCatalogPayload>;
