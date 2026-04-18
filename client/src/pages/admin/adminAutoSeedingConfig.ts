import { PRESET_LOCATIONS } from '@/contexts/LocationContext';

import type { DiscoverDiningScrapePayload } from '@/api/adminIngestion';

/** Cities in dealSources.json not always on locator list (e.g. Mason). */
const ADMIN_EXTRA_CITIES: { value: string; label: string }[] = [{ value: 'Mason', label: 'Mason, MI' }];

export function buildAdminCityPickerOptions(): { value: string; label: string }[] {
  const m = new Map<string, string>();
  for (const l of PRESET_LOCATIONS) {
    const city = l.name.split(',')[0].trim();
    m.set(city, l.name);
  }
  for (const e of ADMIN_EXTRA_CITIES) {
    if (!m.has(e.value)) m.set(e.value, e.label);
  }
  return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

export const DISCOVER_PRESET_IDS = [
  'flint',
  'lansing',
  'saginaw',
  'frankenmuth',
  'east',
  'kalamazoo',
  'wide',
] as const;

export type DiscoverPresetId = (typeof DISCOVER_PRESET_IDS)[number];

/** Few cities per run = faster, more reliable jobs than one huge nearText. */
export const DISCOVER_PRESETS: Record<DiscoverPresetId, DiscoverDiningScrapePayload> = {
  flint: {
    cities: ['Flint', 'Grand Blanc', 'Fenton'],
    maxPlaces: 14,
    queryRotationLimit: 5,
    maxFollowUpUrls: 5,
    maxDealsPerVenue: 3,
    maxItemsPerSite: 8,
    delayBetweenVenuesMs: 3500,
  },
  lansing: {
    cities: ['Lansing', 'East Lansing', 'Okemos'],
    maxPlaces: 14,
    queryRotationLimit: 5,
    maxFollowUpUrls: 5,
    maxDealsPerVenue: 3,
    maxItemsPerSite: 8,
    delayBetweenVenuesMs: 3500,
  },
  saginaw: {
    cities: ['Saginaw', 'Midland', 'Bay City'],
    maxPlaces: 14,
    queryRotationLimit: 5,
    maxFollowUpUrls: 5,
    maxDealsPerVenue: 3,
    maxItemsPerSite: 8,
    delayBetweenVenuesMs: 3500,
  },
  frankenmuth: {
    cities: ['Frankenmuth', 'Bridgeport', 'Birch Run'],
    maxPlaces: 14,
    queryRotationLimit: 5,
    maxFollowUpUrls: 5,
    maxDealsPerVenue: 3,
    maxItemsPerSite: 8,
    delayBetweenVenuesMs: 3500,
  },
  east: {
    cities: ['Owosso', 'Corunna', 'Durand'],
    maxPlaces: 12,
    queryRotationLimit: 4,
    maxFollowUpUrls: 4,
    maxDealsPerVenue: 3,
    maxItemsPerSite: 8,
    delayBetweenVenuesMs: 3500,
  },
  kalamazoo: {
    cities: ['Kalamazoo', 'Portage', 'Battle Creek'],
    maxPlaces: 14,
    queryRotationLimit: 5,
    maxFollowUpUrls: 5,
    maxDealsPerVenue: 3,
    maxItemsPerSite: 8,
    delayBetweenVenuesMs: 3500,
  },
  wide: {
    nearText:
      'Lansing Flint Grand Blanc Saginaw Midland Bay City Frankenmuth Bridgeport Birch Run Owosso Fenton Grand Rapids Kalamazoo Ann Arbor Michigan',
    maxPlaces: 18,
    queryRotationLimit: 6,
    maxFollowUpUrls: 6,
    maxDealsPerVenue: 3,
    maxItemsPerSite: 8,
    delayBetweenVenuesMs: 4000,
  },
};
