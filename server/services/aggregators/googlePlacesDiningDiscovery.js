/**
 * Google Places Text Search + Details for dining venue discovery (official API only).
 * Returns venues with a public website so we can scrape merchant-owned pages — not GBP posts.
 */

const axios = require('axios');

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

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
 * @param {object} options
 * @param {string} [options.searchQuery] - e.g. "restaurant"
 * @param {string} [options.nearText] - e.g. "Lansing MI" (combined into Places text query)
 * @param {number} [options.maxPlaces] - cap (default 12, max 30)
 */
async function discoverDiningPlaces(options = {}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key?.trim()) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  const searchQuery = (options.searchQuery || 'restaurant').trim();
  const nearText = (options.nearText || 'Lansing Flint Michigan').trim();
  const fullQuery = `${searchQuery} ${nearText}`;
  const maxPlaces = Math.min(Math.max(Number(options.maxPlaces) || 12, 1), 30);

  const places = [];
  const seen = new Set();
  let nextPageToken = null;
  let page = 0;
  const maxPages = 3;

  while (places.length < maxPlaces && page < maxPages) {
    const params = {
      query: fullQuery,
      key,
      type: 'restaurant',
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
        city: city || nearText.split(',')[0] || 'Michigan',
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

  console.log(`[placesDiningDiscovery] Found ${places.length} venues with websites (query: "${fullQuery}")`);
  return places;
}

module.exports = {
  discoverDiningPlaces,
  normalizeWebsite,
};
