import { dwigo } from '@/lib/dwigo';

export interface PreferencesPayload {
  preferredCategories: string[];
  preferredBrands: string[];
  preferredLocations: string[];
  budgetPreferences: Record<string, unknown> | null;
  notificationSettings: Record<string, unknown> | null;
  travelPreferences: Record<string, unknown> | null;
  privacySettings: Record<string, unknown> | null;
  consentVersion?: string | null;
  consentUpdatedAt?: string | null;
}

export const fetchPreferences = () => dwigo.get<PreferencesPayload | null>('/preferences');

export const updatePreferences = (payload: PreferencesPayload) =>
  dwigo.put<PreferencesPayload, PreferencesPayload | null>('/preferences', payload);

export interface FavoritePlacePayload {
  placeName: string;
  placeType?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
}

export interface FavoritePlace {
  id: number;
  user_id: number;
  place_name: string;
  place_type: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  created_at: string;
}

export const fetchFavoritePlaces = () => dwigo.get<FavoritePlace[]>('/preferences/favorite-places');

export const addFavoritePlace = (payload: FavoritePlacePayload) =>
  dwigo.post<FavoritePlacePayload, FavoritePlace>('/preferences/favorite-places', payload);

export const deleteFavoritePlace = (id: number) =>
  dwigo.delete<{ removed: boolean; id: number }>(`/preferences/favorite-places/${id}`);

export interface MerchantSuggestionPayload {
  merchantName: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface MerchantSuggestion {
  id: number;
  userId: number;
  merchantName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  createdAt: string;
}

export const fetchMerchantSuggestions = () =>
  dwigo.get<MerchantSuggestion[]>('/preferences/merchant-suggestions');

export const addMerchantSuggestion = (payload: MerchantSuggestionPayload) =>
  dwigo.post<MerchantSuggestionPayload, MerchantSuggestion>(
    '/preferences/merchant-suggestions',
    payload
  );

export const deleteMerchantSuggestion = (id: number) =>
  dwigo.delete<{ removed: boolean; id: number }>(`/preferences/merchant-suggestions/${id}`);

