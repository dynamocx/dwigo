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
  updated_at: string;
}

export const addFavoritePlace = (payload: FavoritePlacePayload) =>
  dwigo.post<FavoritePlacePayload, FavoritePlace>('/preferences/favorite-places', payload);

