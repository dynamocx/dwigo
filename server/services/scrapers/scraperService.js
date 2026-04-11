/**
 * Scraper Service - Main orchestrator
 * 
 * Coordinates scraping, extraction, and ingestion
 */

const fs = require('fs');
const path = require('path');
const { fetchDealSource } = require('./baseScraper');
const { processScrapedContent, tryExtractSingleDealFromPage } = require('./dealExtractor');
const { processIngestionJob } = require('../ingestion');
const { discoverDiningPlaces } = require('../aggregators/googlePlacesDiningDiscovery');
const { scrapeGbpPublicTextFromMaps, mapsPlaceUrl } = require('../aggregators/googleMapsGbpSnippet');

const DEAL_SOURCES_PATH = path.join(__dirname, '../../config/dealSources.json');

/**
 * Load deal sources configuration from server/config/dealSources.json.
 *
 * Optional env: SCRAPER_CATEGORY_FILTER — e.g. "Dining" to run only food/drink venues
 * for a POC (matches each source's `category` field). Leave unset to scrape all enabled sources.
 */
function loadDealSources() {
  try {
    const data = fs.readFileSync(DEAL_SOURCES_PATH, 'utf8');
    let sources = JSON.parse(data);
    sources = sources.filter((source) => source.enabled !== false);

    const categoryFilter = (process.env.SCRAPER_CATEGORY_FILTER || '').trim();
    if (categoryFilter) {
      const want = categoryFilter.toLowerCase();
      const before = sources.length;
      sources = sources.filter((s) => (s.category || '').toLowerCase() === want);
      console.log(
        `[scraperService] SCRAPER_CATEGORY_FILTER="${categoryFilter}": ${before} → ${sources.length} source(s)`
      );
    }

    return sources;
  } catch (error) {
    console.error('[scraperService] Failed to load deal sources:', error.message);
    return [];
  }
}

/** Selectors for unknown restaurant sites — homepage + common CMS/promo patterns. */
const PLACES_DISCOVERY_SELECTORS = {
  item:
    'article, [role="article"], main section, [class*="special"], [class*="happy"], [class*="offer"], [class*="promo"], [class*="deal"], [class*="event"], [class*="menu-item"], [class*="elementor"], .sqs-block-content, [data-testid*="menu"], section, main > div',
  title: 'h1, h2, h3, h4, [class*="title"]',
  desc: 'p, li, [class*="description"], [class*="excerpt"]',
};

/** Second-pass paths on same origin when homepage yields little promo content. */
const DINING_FOLLOW_UP_PATHS = [
  '/specials',
  '/special-offers',
  '/offers',
  '/promotions',
  '/events',
  '/happy-hour',
  '/happy-hour-specials',
  '/menu',
  '/lunch-specials',
  '/dinner-specials',
];

function diningSiteOrigin(website) {
  try {
    const u = new URL(website);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function diningFollowUpUrls(website) {
  const origin = diningSiteOrigin(website);
  if (!origin) return [];
  return DINING_FOLLOW_UP_PATHS.map((p) => `${origin}${p}`);
}

function mergeDealsDedupeByTitle(existing, incoming) {
  const out = [...existing];
  for (const m of incoming) {
    if (!m?.title) continue;
    const t = m.title.toLowerCase().trim();
    if (out.some((d) => d.title && d.title.toLowerCase().trim() === t)) continue;
    out.push(m);
  }
  return out;
}

function dedupeAllDealsByPlaceAndTitle(deals) {
  const seen = new Set();
  return deals.filter((d) => {
    const t = (d.title || '').toLowerCase().trim();
    if (!t) return false;
    const k = `${d.googlePlaceId || ''}::${t}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function extractDealsFromRenderedScrape(p, scrapeResult, maxItemsPerSite) {
  const sr = { ...scrapeResult };
  if (sr.success && sr.extractedItems?.length > maxItemsPerSite) {
    sr.extractedItems = sr.extractedItems.slice(0, maxItemsPerSite);
  }
  let deals = await processScrapedContent(sr);
  if (deals.length === 0 && sr.success && sr.html) {
    const one = await tryExtractSingleDealFromPage(p.name, p.city, p.state, sr.html, sr.url, {
      category: 'Dining',
    });
    if (one) deals = [one];
  }
  return deals;
}

function buildIngestionDealsFromScraped(allDeals) {
  return allDeals.map((deal) => ({
    merchantAlias: deal.merchantName || 'Unknown Merchant',
    rawPayload: {
      title: deal.title,
      description: deal.description,
      category: deal.category,
      city: deal.city,
      state: deal.state,
      startDate: deal.startDate,
      endDate: deal.endDate,
      price: deal.price,
      discountPercentage: deal.discountPercentage,
      discountValue: deal.discountValue,
      sourceUrl: deal.sourceUrl,
      extractionMethod: deal.extractionMethod,
      syntheticDeal: false,
      dataSource: deal.dataSource || 'website_scrape',
      googlePlaceId: deal.googlePlaceId || null,
    },
    normalizedPayload: {
      title: deal.title,
      category: deal.category,
      location: {
        city: deal.city,
        state: deal.state,
        latitude: deal.latitude ?? null,
        longitude: deal.longitude ?? null,
      },
      syntheticDeal: false,
      ...(deal.discountPercentage
        ? {
            discount: {
              type: 'percentage',
              value: deal.discountPercentage,
            },
          }
        : {}),
      ...(deal.price
        ? {
            price: {
              currency: 'USD',
              amount: deal.price,
            },
          }
        : {}),
    },
    confidence: deal.confidence != null ? Number(deal.confidence) : 0.75,
  }));
}

async function ingestScrapedDeals(allDeals, source, scope) {
  if (!allDeals.length) {
    return {
      success: false,
      error: 'No deals to ingest',
      jobId: null,
      stats: { total: 0, recorded: 0, errors: 0 },
    };
  }
  const ingestionDeals = buildIngestionDealsFromScraped(allDeals);
  const result = await processIngestionJob({
    source,
    scope,
    deals: ingestionDeals,
  });
  return {
    success: true,
    jobId: result.jobId,
    stats: result.stats,
    dealsIngested: ingestionDeals.length,
  };
}

/**
 * Google Places dining discovery → each venue's website → scrape + LLM → ingestion.
 */
async function discoverPlacesAndScrapeDining(options = {}) {
  if (!process.env.GOOGLE_PLACES_API_KEY?.trim()) {
    return {
      success: false,
      error: 'GOOGLE_PLACES_API_KEY not configured',
      venuesFound: 0,
      venuesScraped: 0,
      dealsExtracted: 0,
      dealsIngested: 0,
      results: [],
    };
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return {
      success: false,
      error: 'OPENAI_API_KEY required for extraction from discovered sites',
      venuesFound: 0,
      venuesScraped: 0,
      dealsExtracted: 0,
      dealsIngested: 0,
      results: [],
    };
  }

  const maxItemsPerSite = Math.min(Math.max(Number(options.maxItemsPerSite) || 8, 1), 15);
  const delayMs = Math.max(Number(options.delayBetweenVenuesMs) || 4000, 2000);
  const maxDealsPerVenue = Math.min(Math.max(Number(options.maxDealsPerVenue) || 4, 1), 8);
  const hasCityBatch = Array.isArray(options.cities) && options.cities.length > 0;
  const defaultFollowUps = hasCityBatch ? 5 : 6;
  const maxFollowUpUrls = Math.min(
    Math.max(Number(options.maxFollowUpUrls) || defaultFollowUps, 0),
    12
  );

  let places;
  try {
    places = await discoverDiningPlaces({
      searchQuery: options.searchQuery,
      searchQueries: options.searchQueries,
      nearText: options.nearText,
      cities: options.cities,
      queryRotationLimit: options.queryRotationLimit,
      maxPlaces: options.maxPlaces,
    });
  } catch (e) {
    return {
      success: false,
      error: e.message || 'Places discovery failed',
      venuesFound: 0,
      venuesScraped: 0,
      dealsExtracted: 0,
      dealsIngested: 0,
      results: [],
    };
  }

  const allDeals = [];
  const results = [];

  for (const p of places) {
    const sourceConfig = {
      id: `gpdisc_${p.placeId}`,
      merchantName: p.name,
      city: p.city,
      state: p.state,
      type: 'restaurant',
      category: 'Dining',
      url: p.website,
      fetchMode: 'renderedHtml',
      selectors: PLACES_DISCOVERY_SELECTORS,
      keywords: [],
      enabled: true,
    };

    let scrapeResult;
    try {
      scrapeResult = await fetchDealSource(sourceConfig);
    } catch (err) {
      results.push({
        placeId: p.placeId,
        name: p.name,
        website: p.website,
        success: false,
        error: err.message,
        dealsFound: 0,
      });
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    let deals = await extractDealsFromRenderedScrape(p, scrapeResult, maxItemsPerSite);

    const homeUrlNorm = (scrapeResult.url || p.website || '').replace(/\/$/, '');
    let followUpsTried = 0;
    for (const extraUrl of diningFollowUpUrls(p.website)) {
      if (deals.length >= maxDealsPerVenue) break;
      if (followUpsTried >= maxFollowUpUrls) break;
      const extraNorm = extraUrl.replace(/\/$/, '');
      if (extraNorm === homeUrlNorm) continue;

      followUpsTried += 1;
      try {
        const cfg = {
          ...sourceConfig,
          id: `${sourceConfig.id}_u${followUpsTried}`,
          url: extraUrl,
        };
        const sr2 = await fetchDealSource(cfg);
        if (!sr2.success || !sr2.html) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        const more = await extractDealsFromRenderedScrape(p, sr2, maxItemsPerSite);
        deals = mergeDealsDedupeByTitle(deals, more);
      } catch (e) {
        console.warn(`[discoverPlacesAndScrapeDining] follow-up ${extraUrl}:`, e.message);
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    let gbpText = null;
    if (process.env.ENABLE_GBP_MAPS_SCRAPE === 'true') {
      try {
        gbpText = await scrapeGbpPublicTextFromMaps(p.placeId);
      } catch (e) {
        console.warn(`[discoverPlacesAndScrapeDining] GBP maps snippet failed for ${p.name}:`, e.message);
      }
    }

    if (gbpText) {
      const mapsUrl = mapsPlaceUrl(p.placeId);
      const safe = gbpText.replace(/</g, ' ');
      const gbpHtml = `<article><h1>Visible text from Google Maps business listing</h1><p>${safe}</p></article>`;
      const gbpDeal = await tryExtractSingleDealFromPage(p.name, p.city, p.state, gbpHtml, mapsUrl, {
        category: 'Dining',
        extractionMethod: 'places-discovery+gbp-maps-visible-text',
        confidence: 0.68,
      });
      if (gbpDeal) {
        const dup = deals.some(
          (d) => d.title && gbpDeal.title && d.title.toLowerCase() === gbpDeal.title.toLowerCase()
        );
        if (!dup) deals.push(gbpDeal);
      }
    }

    if (deals.length > maxDealsPerVenue) {
      deals = deals.slice(0, maxDealsPerVenue);
    }

    const enriched = deals.map((d) => ({
      ...d,
      merchantName: p.name,
      city: p.city,
      state: p.state,
      category: 'Dining',
      googlePlaceId: p.placeId,
      dataSource:
        (d.extractionMethod || '').includes('gbp-maps') ? 'places_discovery_gbp_maps' : 'places_discovery_website',
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    allDeals.push(...enriched);
    results.push({
      placeId: p.placeId,
      name: p.name,
      website: p.website,
      success: scrapeResult.success,
      error: scrapeResult.success ? null : scrapeResult.error,
      dealsFound: enriched.length,
    });

    await new Promise((r) => setTimeout(r, delayMs));
  }

  if (allDeals.length === 0) {
    return {
      success: false,
      error: 'No deals extracted from discovered venues (check selectors, Playwright, or page content)',
      venuesFound: places.length,
      venuesScraped: results.length,
      dealsExtracted: 0,
      dealsIngested: 0,
      results,
    };
  }

  const scopeLabel =
    (options.nearText && String(options.nearText).trim()) ||
    (options.cities?.length ? options.cities.join(' ') : '') ||
    'mi';
  const scope = `dining:places-discovery:${scopeLabel.replace(/\s+/g, '-')}`;

  const deduped = dedupeAllDealsByPlaceAndTitle(allDeals);
  if (deduped.length < allDeals.length) {
    console.log(`[discoverPlacesAndScrapeDining] deduped ${allDeals.length - deduped.length} duplicate title(s) per place`);
  }

  const ing = await ingestScrapedDeals(deduped, 'scraper:places-discovery', scope);

  return {
    success: true,
    venuesFound: places.length,
    venuesScraped: results.length,
    dealsExtracted: deduped.length,
    dealsIngested: ing.dealsIngested,
    jobId: ing.jobId,
    stats: ing.stats,
    results,
  };
}

/**
 * Scrape a single source and extract deals
 */
async function scrapeSource(sourceConfig) {
  console.log(`[scraperService] Scraping ${sourceConfig.id}: ${sourceConfig.merchantName}`);
  
  // Fetch HTML
  const scrapeResult = await fetchDealSource(sourceConfig);
  
  if (!scrapeResult.success) {
    console.error(`[scraperService] Failed to scrape ${sourceConfig.id}:`, scrapeResult.error);
    return {
      sourceId: sourceConfig.id,
      success: false,
      error: scrapeResult.error,
      deals: [],
    };
  }

  // Extract deals from HTML
  const deals = await processScrapedContent(scrapeResult);
  
  // Validate all deals use the correct merchant name (never trust LLM's merchant name)
  const validatedDeals = deals.map(deal => ({
    ...deal,
    merchantName: sourceConfig.merchantName, // Always use source config merchant name
  }));
  
  console.log(`[scraperService] Extracted ${validatedDeals.length} deals from ${sourceConfig.id} (${sourceConfig.merchantName})`);

  return {
    sourceId: sourceConfig.id,
    merchantName: sourceConfig.merchantName,
    success: true,
    deals: validatedDeals,
    itemCount: scrapeResult.itemCount || 0,
    extractedCount: validatedDeals.length,
  };
}

/**
 * Scrape all enabled sources
 */
async function scrapeAllSources() {
  const sources = loadDealSources();
  const results = [];

  console.log(`[scraperService] Starting scrape of ${sources.length} sources`);

  for (const source of sources) {
    try {
      const result = await scrapeSource(source);
      results.push(result);
      
      // Be polite - wait between sources to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds between sources
    } catch (error) {
      console.error(`[scraperService] Error scraping ${source.id}:`, error);
      results.push({
        sourceId: source.id,
        success: false,
        error: error.message,
        deals: [],
      });
    }
  }

  return results;
}

/**
 * Scrape sources and ingest deals
 */
async function scrapeAndIngest() {
  console.log('[scraperService] Starting scrapeAndIngest...');
  const sources = loadDealSources();
  console.log(`[scraperService] Loaded ${sources.length} deal sources`);
  
  if (sources.length === 0) {
    console.warn('[scraperService] No deal sources configured! Check server/config/dealSources.json');
    return {
      success: false,
      error: 'No deal sources configured',
      sourcesScraped: 0,
      dealsExtracted: 0,
      dealsIngested: 0,
      results: [],
    };
  }
  
  const results = await scrapeAllSources();
  
  // Log detailed results
  console.log(`[scraperService] Scraping completed. Results:`, results.map(r => ({
    sourceId: r.sourceId,
    success: r.success,
    dealsCount: r.deals?.length || 0,
    error: r.error,
  })));
  
  // Collect all deals and validate merchant names
  const allDeals = [];
  for (const result of results) {
    if (result.success && result.deals && result.deals.length > 0) {
      // Double-check merchant names match source config
      const validated = result.deals.map(deal => ({
        ...deal,
        merchantName: result.merchantName, // Use source merchant name, never LLM's version
      }));
      allDeals.push(...validated);
      console.log(`[scraperService] Added ${validated.length} deals from ${result.sourceId}`);
    } else {
      console.warn(`[scraperService] Skipping ${result.sourceId}: success=${result.success}, deals=${result.deals?.length || 0}, error=${result.error || 'none'}`);
    }
  }
  
  console.log(`[scraperService] Total deals collected: ${allDeals.length}`);
  if (allDeals.length > 0) {
    console.log(`[scraperService] Unique merchants: ${[...new Set(allDeals.map(d => d.merchantName))].join(', ')}`);
  }

  if (allDeals.length === 0) {
    console.warn('[scraperService] No deals extracted from any source. This could mean:');
    console.warn('[scraperService] 1. Websites are blocking requests');
    console.warn('[scraperService] 2. CSS selectors don\'t match the website structure');
    console.warn('[scraperService] 3. Playwright not installed (for renderedHtml mode)');
    console.warn('[scraperService] 4. Network connectivity issues');
    return {
      success: false,
      error: 'No deals extracted from any source. Check server logs for details.',
      sourcesScraped: results.length,
      dealsExtracted: 0,
      dealsIngested: 0,
      results,
    };
  }

  const cat = (process.env.SCRAPER_CATEGORY_FILTER || '').trim();
  const scope = cat ? `mid-michigan-pilot:${cat.toLowerCase()}` : 'mid-michigan-pilot';

  const ingestionDeals = buildIngestionDealsFromScraped(allDeals);
  const payload = {
    source: 'scraper:web',
    scope,
    deals: ingestionDeals,
  };

  console.log(`[scraperService] Ingesting ${ingestionDeals.length} deals with source: ${payload.source}`);

  const ingestionResult = await processIngestionJob(payload);

  return {
    success: true,
    sourcesScraped: results.length,
    dealsExtracted: allDeals.length,
    dealsIngested: ingestionDeals.length,
    jobId: ingestionResult.jobId,
    stats: ingestionResult.stats,
    results,
  };
}

module.exports = {
  scrapeSource,
  scrapeAllSources,
  scrapeAndIngest,
  loadDealSources,
  discoverPlacesAndScrapeDining,
  buildIngestionDealsFromScraped,
};

