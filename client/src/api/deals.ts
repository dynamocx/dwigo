import type { DwigoEnvelope } from '@/lib/dwigo';
import { dwigo } from '@/lib/dwigo';
import type { Deal } from '@/types/deal';

interface DealResponse {
  id: number;
  merchant_id: number;
  title: string;
  description: string | null;
  original_price: string | null;
  deal_price: string | null;
  discount_percentage: string | null;
  category: string | null;
  subcategory: string | null;
  start_date: string | null;
  end_date: string | null;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  image_url: string | null;
  terms_conditions: string | null;
  created_at: string;
  updated_at: string;
  business_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  business_type: string | null;
  is_saved?: boolean;
  distance_meters?: number | null;
  status?: string | null;
  visibility?: string | null;
  location_id?: number | null;
  source_type?: string | null;
  source_reference?: string | null;
  confidence_score?: number | null;
  last_seen_at?: string | null;
  is_active?: boolean | null; // legacy column support
  website?: string | null;
}

const parseCurrency = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const mapDeal = (deal: DealResponse): Deal => ({
  id: deal.id,
  title: deal.title,
  description: deal.description,
  originalPrice: parseCurrency(deal.original_price),
  dealPrice: parseCurrency(deal.deal_price),
  discountPercentage: parseCurrency(deal.discount_percentage),
  category: deal.category,
  startDate: deal.start_date,
  endDate: deal.end_date,
  isActive: deal.status ? deal.status === 'active' : Boolean(deal.is_active),
  imageUrl: deal.image_url,
  termsConditions: deal.terms_conditions,
  businessName: deal.business_name || 'Business',
  businessType: deal.business_type,
  address: deal.address,
  city: deal.city,
  state: deal.state,
  latitude: deal.latitude,
  longitude: deal.longitude,
  isSaved: deal.is_saved,
  distanceMeters: deal.distance_meters ?? null,
  sourceReference: deal.source_reference ?? null,
  sourceType: deal.source_type ?? null,
  website: deal.website ?? null,
});

const transformDealsEnvelope = (envelope: DwigoEnvelope<DealResponse[] | undefined>): DwigoEnvelope<Deal[]> => ({
  ...envelope,
  data: (envelope.data ?? []).map(mapDeal),
});

export const fetchDeals = async (
  params?: Record<string, string | number | undefined>
): Promise<DwigoEnvelope<Deal[]>> => {
  const envelope = await dwigo.get<DealResponse[]>('/deals', { params });
  return transformDealsEnvelope(envelope);
};

export const fetchPersonalisedDeals = async (): Promise<DwigoEnvelope<Deal[]>> => {
  const envelope = await dwigo.get<DealResponse[]>('/deals/personalized');
  return transformDealsEnvelope(envelope);
};

export const toggleDealSaved = async (dealId: number): Promise<boolean> => {
  const envelope = await dwigo.post<undefined, { saved: boolean }>(`/deals/${dealId}/save`);
  return envelope.data?.saved ?? false;
};

export const fetchDeal = async (dealId: number): Promise<DwigoEnvelope<Deal>> => {
  const envelope = await dwigo.get<DealResponse>(`/deals/${dealId}`);
  return {
    ...envelope,
    data: envelope.data ? mapDeal(envelope.data) : null,
  };
};

export const trackDealView = async (dealId: number) => {
  await dwigo.post<undefined, { tracked: boolean }>(`/deals/${dealId}/view`);
};

export const fetchSavedDeals = async (): Promise<DwigoEnvelope<Deal[]>> => {
  const envelope = await dwigo.get<DealResponse[]>('/deals/saved');
  return transformDealsEnvelope(envelope);
};

