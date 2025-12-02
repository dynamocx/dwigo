/**
 * Scraper Service - Main orchestrator
 * 
 * Coordinates scraping, extraction, and ingestion
 */

const fs = require('fs');
const path = require('path');
const { fetchDealSource } = require('./baseScraper');
const { processScrapedContent } = require('./dealExtractor');
const { processIngestionJob } = require('../ingestion');

const DEAL_SOURCES_PATH = path.join(__dirname, '../../config/dealSources.json');

/**
 * Load deal sources configuration
 */
function loadDealSources() {
  try {
    const data = fs.readFileSync(DEAL_SOURCES_PATH, 'utf8');
    const sources = JSON.parse(data);
    return sources.filter(source => source.enabled !== false);
  } catch (error) {
    console.error('[scraperService] Failed to load deal sources:', error.message);
    return [];
  }
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

  // Transform to ingestion format
  const ingestionDeals = allDeals.map(deal => ({
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
    },
    normalizedPayload: {
      title: deal.title,
      category: deal.category,
      location: {
        city: deal.city,
        state: deal.state,
      },
      ...(deal.discountPercentage ? {
        discount: {
          type: 'percentage',
          value: deal.discountPercentage,
        },
      } : {}),
      ...(deal.price ? {
        price: {
          currency: 'USD',
          amount: deal.price,
        },
      } : {}),
    },
    confidence: deal.confidence || 0.75,
  }));

  const payload = {
    source: 'scraper:web', // CRITICAL: This must be 'scraper:web' not 'ai:deal-fetching-agent'
    scope: 'mid-michigan-pilot',
    deals: ingestionDeals,
  };
  
  console.log(`[scraperService] Ingesting ${ingestionDeals.length} deals with source: ${payload.source}`);
  console.log(`[scraperService] Payload source verification: ${payload.source} (should be 'scraper:web')`);
  
  // Double-check source is correct before ingestion
  if (payload.source !== 'scraper:web') {
    console.error(`[scraperService] CRITICAL ERROR: Source is '${payload.source}' but should be 'scraper:web'!`);
    throw new Error(`Invalid source: ${payload.source}. Expected 'scraper:web'`);
  }

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
};

