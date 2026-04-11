/**
 * Google Places Text Search + Details for dining venue discovery (official API only).
 * Returns venues with a public website so we can scrape merchant-owned pages.
 * GBP posts are not available via Places API; optional Maps-visible text is handled in scraperService + googleMapsGbpSnippet (ENABLE_GBP_MAPS_SCRAPE).
 */

const axios = require('axios');

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

/** Default geographic bias for Mid-Michigan + extended pilot (single text-search bias string). */
const DEFAULT_NEAR_TEXT =
  process.env.PLACES_DINING_NEAR_TEXT?.trim() ||
  'Lansing Flint Grand Blanc Saginaw Midland Bay City Frankenmuth Owosso Fenton Grand Rapids Kalamazoo Ann Arbor Michigan';

/** Rotate queries to diversify venues (same region, different result sets). */
const DEFAULT_SEARCH_QUERIES = [
  'restaurant',
  'cafe',
  'bar grill',
  'brewery taproom',
  'pizza',
  'Mexican restaurant',
  'breakfast brunch',
];

function normalizeWebsite(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

function parseCityState(components) {
  let city = '';
  let state = '';
  for (const c of components || []) {
    if (c.types?.includes('locality')) city = c.long_name;
    if (c.types?.includes('administrative_area_level_1')) state = c.short_name || c.long_name;
  }
  return { city, state };
}

/**
 * Add venues from one Text Search query (+ pagination) until maxPlaces or exhausted.
 */
async function appendPlacesForQuery(places, seen, fullQuery, maxPlaces, key, nearTextFallback) {
  let nextPageToken = null;
  let page = 0;
  const maxPages = 3;

  while (places.length < maxPlaces && page < maxPages) {
    // No `type` filter — queries like "cafe" / "bar" need non-restaurant place types.
    const params = {
      query: fullQuery,
      key,
    };
    if (nextPageToken) {
      params.pagetoken = nextPageToken;
    }

    const { data } = await axios.get(`${PLACES_BASE}/textsearch/json`, {
      params,
      timeout: 20000,
    });

    if (data.status === 'ZERO_RESULTS') {
      break;
    }
    if (data.status !== 'OK') {
      throw new Error(data.error_message || `Places text search: ${data.status}`);
    }

    const results = data.results || [];
    for (const r of results) {
      if (places.length >= maxPlaces) break;
      if (!r.place_id || seen.has(r.place_id)) continue;
      seen.add(r.place_id);

      await new Promise((res) => setTimeout(res, 180));

      let detailRes;
      try {
        detailRes = await axios.get(`${PLACES_BASE}/details/json`, {
          params: {
            place_id: r.place_id,
            fields: 'name,formatted_address,geometry,types,website,address_components',
            key,
          },
          timeout: 15000,
        });
      } catch (e) {
        console.warn(`[placesDiningDiscovery] details failed for ${r.place_id}:`, e.message);
        continue;
      }

      const det = detailRes.data;
      if (det.status !== 'OK' || !det.result) continue;

      const website = normalizeWebsite(det.result.website);
      if (!website) {
        console.log(`[placesDiningDiscovery] skip (no website): ${det.result.name}`);
        continue;
      }

      const { city, state } = parseCityState(det.result.address_components);
      places.push({
        placeId: r.place_id,
        name: det.result.name,
        formattedAddress: det.result.formatted_address,
        city: city || nearTextFallback.split(',')[0] || 'Michigan',
        state: state || 'MI',
        latitude: det.result.geometry?.location?.lat ?? null,
        longitude: det.result.geometry?.location?.lng ?? null,
        types: det.result.types || [],
        website,
      });
    }

    nextPageToken = data.next_page_token;
    if (!nextPageToken) break;
    page += 1;
    await new Promise((res) => setTimeout(res, 2100));
  }
}

/**
 * @param {object} options
 * @param {string} [options.searchQuery] - primary query (used with multi-query rotation if searchQueries omitted)
 * @param {string[]} [options.searchQueries] - override rotation list
 * @param {string} [options.nearText] - geographic bias
 * @param {number} [options.maxPlaces] - cap (default 24, max 45)
 */
async function discoverDiningPlaces(options = {}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key?.trim()) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  const nearText = (options.nearText || DEFAULT_NEAR_TEXT).trim();
  const maxPlaces = Math.min(Math.max(Number(options.maxPlaces) || 24, 1), 45);

  let queries =
    Array.isArray(options.searchQueries) && options.searchQueries.length > 0
      ? options.searchQueries.map((q) => String(q).trim()).filter(Boolean)
      : null;

  if (!queries) {
    const primary = (options.searchQuery || 'restaurant').trim();
    queries = [primary, ...DEFAULT_SEARCH_QUERIES.filter((q) => q.toLowerCase() !== primary.toLowerCase())];
  }

  const places = [];
  const seen = new Set();

  for (const sq of queries) {
    if (places.length >= maxPlaces) break;
    const fullQuery = `${sq} ${nearText}`;
    console.log(`[placesDiningDiscovery] query "${fullQuery}" (have ${places.length}/${maxPlaces})`);
    await appendPlacesForQuery(places, seen, fullQuery, maxPlaces, key, nearText);
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`[placesDiningDiscovery] Found ${places.length} venues with websites (${queries.length} query rotation(s), near: "${nearText}")`);
  return places;
}

module.exports = {
  discoverDiningPlaces,
  normalizeWebsite,
  DEFAULT_NEAR_TEXT,
};
