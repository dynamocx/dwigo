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
  
  console.log(`[scraperService] Extracted ${deals.length} deals from ${sourceConfig.id}`);

  return {
    sourceId: sourceConfig.id,
    merchantName: sourceConfig.merchantName,
    success: true,
    deals,
    itemCount: scrapeResult.itemCount || 0,
    extractedCount: deals.length,
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
      
      // Be polite - wait between sources
      await new Promise(resolve => setTimeout(resolve, 2000));
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
  const results = await scrapeAllSources();
  
  // Collect all deals
  const allDeals = [];
  for (const result of results) {
    if (result.success && result.deals) {
      allDeals.push(...result.deals);
    }
  }

  if (allDeals.length === 0) {
    console.log('[scraperService] No deals extracted from any source');
    return {
      success: true,
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
    source: 'scraper:web',
    scope: 'mid-michigan-pilot',
    deals: ingestionDeals,
  };

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

