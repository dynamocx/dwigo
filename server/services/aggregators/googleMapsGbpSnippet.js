/**
 * Best-effort text from a business's public Google Maps page (consumer UI).
 *
 * Google does NOT expose GBP posts/offers/updates for arbitrary businesses via Places API.
 * The official path is Google Business Profile API (OAuth, business owner). This module
 * optionally loads the Maps place URL with Playwright and extracts visible body text so
 * an LLM can try to pull offers/updates that appear on the page.
 *
 * Enable only with ENABLE_GBP_MAPS_SCRAPE=true. Maps may block bots; respect Google Maps ToS.
 */

const { fetchRenderedHtml } = require('../scrapers/baseScraper');
const cheerio = require('cheerio');

/**
 * @param {string} placeId - Google place_id
 * @returns {Promise<string|null>} Plain text (truncated) or null
 */
async function scrapeGbpPublicTextFromMaps(placeId) {
  if (process.env.ENABLE_GBP_MAPS_SCRAPE !== 'true' || !placeId) {
    return null;
  }

  const url = `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;

  try {
    const res = await fetchRenderedHtml(url, 50000);
    if (!res.success || !res.html) {
      console.warn('[googleMapsGbpSnippet] Maps fetch failed:', res.error || 'no html');
      return null;
    }

    const $ = cheerio.load(res.html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (text.length < 80) {
      return null;
    }

    return text.slice(0, 14000);
  } catch (e) {
    console.warn('[googleMapsGbpSnippet] error:', e.message);
    return null;
  }
}

function mapsPlaceUrl(placeId) {
  return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
}

module.exports = {
  scrapeGbpPublicTextFromMaps,
  mapsPlaceUrl,
};
