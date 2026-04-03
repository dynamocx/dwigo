/**
 * Eventbrite API Integration
 *
 * Eventbrite removed GET /v3/events/search/ (returns 404). Supported flows:
 * - Live events you own: GET /v3/users/me/owned_events/
 * - Live events for organizations you manage: GET /v3/organizations/{id}/events/
 *
 * Docs: https://www.eventbrite.com/platform/api/
 *
 * Env:
 *   EVENTBRITE_API_TOKEN (required)
 *   EVENTBRITE_ORGANIZATION_IDS — optional, comma-separated organization IDs
 *   EVENTBRITE_GEO_FILTER — if "true", keep only events whose venue is near Mid-Michigan (see MID_MICHIGAN_LOCATIONS)
 */

const axios = require('axios');
const { mapEventbriteCategory } = require('../../config/categoryMapping');

const EVENTBRITE_API_BASE = 'https://www.eventbriteapi.com/v3';

/** Centers used only when EVENTBRITE_GEO_FILTER=true */
const MID_MICHIGAN_LOCATIONS = [
  { name: 'Lansing, MI', latitude: 42.7325, longitude: -84.5555 },
  { name: 'Flint, MI', latitude: 43.0125, longitude: -83.6875 },
  { name: 'Grand Blanc, MI', latitude: 42.9275, longitude: -83.6169 },
  { name: 'Fenton, MI', latitude: 42.7978, longitude: -83.705 },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function venueInMidMichiganRegion(event, maxKm = 120) {
  const v = event.venue;
  const lat = v?.latitude != null ? Number(v.latitude) : null;
  const lng = v?.longitude != null ? Number(v.longitude) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return true;
  }
  return MID_MICHIGAN_LOCATIONS.some((loc) => haversineKm(lat, lng, loc.latitude, loc.longitude) <= maxKm);
}

/**
 * Paginate Eventbrite collection endpoints that return { events, pagination }.
 */
async function fetchAllEventsPages(urlPath, apiToken, extraParams = {}) {
  const all = [];
  let page = 1;
  const maxPages = 40;

  while (page <= maxPages) {
    const response = await axios.get(`${EVENTBRITE_API_BASE}${urlPath}`, {
      params: {
        status: 'live',
        expand: 'venue',
        page_size: 50,
        page,
        ...extraParams,
      },
      headers: { Authorization: `Bearer ${apiToken}` },
      timeout: 20000,
    });

    const batch = response.data?.events || [];
    all.push(...batch);
    const pag = response.data?.pagination;
    if (!pag?.has_more_items) break;
    page += 1;
  }

  return all;
}

/**
 * Transform Eventbrite event to DWIGO deal format
 */
const transformEventbriteEvent = (event, locationFallback) => {
  const venue = event.venue || {};
  const startDate = event.start?.utc ? new Date(event.start.utc) : null;
  const endDate = event.end?.utc ? new Date(event.end.utc) : null;

  let price = null;
  let discountPercentage = null;
  if (event.ticket_availability?.is_free) {
    discountPercentage = 100;
  } else if (event.ticket_availability?.minimum_ticket_price) {
    const ticketPrice = event.ticket_availability.minimum_ticket_price;
    price = Number(ticketPrice.major_value) + (Number(ticketPrice.minor_value) || 0) / 100;
  }

  let category = 'Entertainment';
  let categories = ['Entertainment'];

  const categoryName = event.category?.name || event.subcategory?.name || null;
  if (categoryName) {
    categories = mapEventbriteCategory(categoryName);
    category = categories[0] || 'Entertainment';
  } else {
    const categoryId = event.category_id;
    if (categoryId) {
      const categoryIdMap = {
        103: ['Entertainment'],
        104: ['Dining', 'Spirits, Beer & Wine'],
        105: ['Entertainment', 'Wellness'],
        106: ['Travel', 'Entertainment'],
        107: ['Entertainment'],
        108: ['Entertainment'],
        109: ['Wellness'],
        110: ['Entertainment'],
        111: ['Family Activities', 'Entertainment'],
        112: ['Entertainment'],
        113: ['Entertainment'],
        114: ['Entertainment'],
        115: ['Entertainment'],
        116: ['Shopping', 'Entertainment'],
        117: ['Home Improvement', 'Entertainment'],
        118: ['Entertainment'],
        119: ['Entertainment'],
        199: ['Entertainment'],
      };
      categories = categoryIdMap[categoryId] || ['Entertainment'];
      category = categories[0];
    }
  }

  const merchantAlias = venue.name || event.organizer?.name || 'Eventbrite Event';
  const cityFallback = locationFallback?.name?.split(',')[0] || 'Michigan';

  return {
    merchantAlias,
    rawPayload: {
      title: event.name?.text || 'Untitled Event',
      description: event.description?.text || event.summary || null,
      syntheticDeal: false,
      dataSource: 'eventbrite_api',
      category,
      categories,
      address: venue.address?.localized_address_display || venue.address?.address_1 || null,
      city: venue.address?.city || cityFallback,
      state: venue.address?.region || 'MI',
      postalCode: venue.address?.postal_code || null,
      latitude: venue.latitude != null ? Number(venue.latitude) : locationFallback?.latitude ?? null,
      longitude: venue.longitude != null ? Number(venue.longitude) : locationFallback?.longitude ?? null,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      price,
      sourceUrl: event.url || null,
      eventbriteId: event.id,
      eventbriteOrganizerId: event.organizer_id,
      sourceCategory: categoryName || `category_${event.category_id}`,
    },
    normalizedPayload: {
      title: event.name?.text || 'Untitled Event',
      description: event.description?.text || event.summary || null,
      syntheticDeal: false,
      category,
      categories,
      location: {
        city: venue.address?.city || cityFallback,
        state: venue.address?.region || 'MI',
        latitude: venue.latitude != null ? Number(venue.latitude) : locationFallback?.latitude ?? null,
        longitude: venue.longitude != null ? Number(venue.longitude) : locationFallback?.longitude ?? null,
      },
      ...(price
        ? {
            price: {
              currency: 'USD',
              amount: price,
            },
          }
        : {}),
      ...(discountPercentage
        ? {
            discount: {
              type: 'percentage',
              value: discountPercentage,
            },
          }
        : {}),
      schedule: startDate
        ? {
            type: 'one_time',
            rule: {
              startsAt: startDate.toISOString(),
              endsAt: endDate ? endDate.toISOString() : null,
            },
          }
        : null,
      sourceUrl: event.url,
    },
    confidence: 0.85,
  };
};

/**
 * Legacy name: loads live Eventbrite events via supported APIs (not geographic search).
 */
const fetchMidMichiganEvents = async (options = {}) => {
  const apiToken = process.env.EVENTBRITE_API_TOKEN;
  if (!apiToken) {
    console.warn('[Eventbrite] EVENTBRITE_API_TOKEN not set, skipping Eventbrite integration');
    return [];
  }

  const geoFilter =
    String(process.env.EVENTBRITE_GEO_FILTER || '').toLowerCase() === 'true' ||
    options.geoFilter === true;

  const orgIds = (process.env.EVENTBRITE_ORGANIZATION_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const fallbackLoc = MID_MICHIGAN_LOCATIONS[0];
  let rawEvents = [];

  try {
    console.log(
      '[Eventbrite] Fetching your live owned events (GET /users/me/owned_events/) — public /events/search/ is discontinued by Eventbrite.'
    );
    const owned = await fetchAllEventsPages('/users/me/owned_events/', apiToken);
    console.log(`[Eventbrite] Owned live events: ${owned.length}`);
    rawEvents.push(...owned);
  } catch (e) {
    console.error('[Eventbrite] owned_events failed:', e.response?.status || e.message, e.response?.data || '');
  }

  for (const orgId of orgIds) {
    try {
      const orgEvents = await fetchAllEventsPages(`/organizations/${orgId}/events/`, apiToken);
      console.log(`[Eventbrite] Organization ${orgId} live events: ${orgEvents.length}`);
      rawEvents.push(...orgEvents);
    } catch (e) {
      console.error(`[Eventbrite] organization ${orgId} failed:`, e.response?.status || e.message, e.response?.data || '');
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (geoFilter) {
    const before = rawEvents.length;
    rawEvents = rawEvents.filter((ev) => venueInMidMichiganRegion(ev));
    console.log(`[Eventbrite] Geo filter (Mid-Michigan ~120km): ${before} -> ${rawEvents.length}`);
  }

  const seen = new Set();
  const unique = [];
  for (const ev of rawEvents) {
    if (!ev?.id || seen.has(ev.id)) continue;
    seen.add(ev.id);
    unique.push(ev);
  }

  const deals = unique.map((event) => transformEventbriteEvent(event, fallbackLoc));
  console.log(`[Eventbrite] Total unique live events for ingestion: ${deals.length}`);
  if (deals.length === 0) {
    console.log(
      '[Eventbrite] No events returned. Create live events on this Eventbrite account, or set EVENTBRITE_ORGANIZATION_IDS to org IDs you manage.'
    );
  }

  return deals;
};

/**
 * @deprecated Eventbrite removed /events/search/. Use fetchMidMichiganEvents().
 */
const fetchEventsForLocation = async (location, options = {}) => {
  console.warn(
    '[Eventbrite] fetchEventsForLocation is deprecated (search API removed). Using account/org fetch instead.'
  );
  return fetchMidMichiganEvents(options);
};

module.exports = {
  fetchMidMichiganEvents,
  fetchEventsForLocation,
  MID_MICHIGAN_LOCATIONS,
};
