/**
 * Base Scraper Service
 * 
 * Handles fetching HTML from merchant websites using:
 * - Static HTML (axios + cheerio) for simple pages
 * - Rendered HTML (Playwright) for JavaScript-heavy pages
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { chromium } = require('playwright');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch static HTML content
 */
async function fetchStaticHtml(url, timeout = 10000) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout,
      maxRedirects: 5,
    });

    return {
      success: true,
      html: response.data,
      url: response.request.res.responseUrl || url, // Final URL after redirects
      statusCode: response.status,
    };
  } catch (error) {
    console.error(`[baseScraper] Static fetch error for ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      url,
    };
  }
}

/**
 * Fetch rendered HTML using Playwright (for JavaScript-heavy pages)
 */
async function fetchRenderedHtml(url, timeout = 30000) {
  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    
    // Set timeout
    page.setDefaultTimeout(timeout);
    
    // Navigate and wait for content
    await page.goto(url, { waitUntil: 'networkidle', timeout });
    
    // Wait a bit for any lazy-loaded content
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    const finalUrl = page.url();

    await browser.close();

    return {
      success: true,
      html,
      url: finalUrl,
      statusCode: 200,
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error(`[baseScraper] Rendered fetch error for ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      url,
    };
  }
}

/**
 * Extract price from text (e.g., "$15.99", "15.99", "$15")
 */
function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/\$?(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract discount percentage from text (e.g., "20% off", "20%", "save 20%")
 */
function extractDiscountPercentage(text) {
  if (!text) return null;
  const match = text.match(/(\d+)%/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract discount value from text (e.g., "$5 off", "save $5")
 */
function extractDiscountValue(text) {
  if (!text) return null;
  const match = text.match(/\$(\d+\.?\d*)/);
  return match ? `$${match[1]}` : null;
}

/**
 * Extract dates from text (various formats)
 */
function extractDates(text) {
  if (!text) return { startDate: null, endDate: null };
  
  // Try ISO format first
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/g);
  if (isoMatch && isoMatch.length >= 2) {
    return { startDate: isoMatch[0], endDate: isoMatch[1] };
  }
  
  // Try MM/DD/YYYY format
  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
  if (dateMatch && dateMatch.length >= 2) {
    const start = new Date(dateMatch[0]);
    const end = new Date(dateMatch[1]);
    return {
      startDate: isNaN(start.getTime()) ? null : start.toISOString(),
      endDate: isNaN(end.getTime()) ? null : end.toISOString(),
    };
  }
  
  return { startDate: null, endDate: null };
}

/**
 * Extract text content from HTML using CSS selectors
 * Returns structured data ready for ingestion (no LLM needed for structured sites)
 */
function extractWithSelectors(html, selectors) {
  const $ = cheerio.load(html);
  const results = [];

  if (!selectors.item) {
    return results;
  }

  $(selectors.item).each((index, element) => {
    const $item = $(element);
    const title = selectors.title ? $item.find(selectors.title).first().text().trim() : '';
    const description = selectors.desc ? $item.find(selectors.desc).first().text().trim() : '';
    const dateText = selectors.date ? $item.find(selectors.date).first().text().trim() : '';
    const priceText = selectors.price ? $item.find(selectors.price).first().text().trim() : '';
    const discountText = selectors.discount ? $item.find(selectors.discount).first().text().trim() : '';
    
    // Extract structured data directly (no LLM needed)
    const price = extractPrice(priceText);
    const discountPercentage = extractDiscountPercentage(discountText || title || description);
    const discountValue = discountPercentage ? null : extractDiscountValue(discountText || title || description);
    const dates = extractDates(dateText || title || description);
    
    const result = {
      index,
      title,
      description,
      date: dateText,
      price,
      discountPercentage,
      discountValue,
      startDate: dates.startDate,
      endDate: dates.endDate,
      rawHtml: $item.html() || '',
      // Flag if we got enough structured data (might not need LLM)
      isStructured: !!(title && (price || discountPercentage || discountValue)),
    };

    // Only include if we got at least a title
    if (result.title) {
      results.push(result);
    }
  });

  return results;
}

/**
 * Check if content contains deal keywords
 */
function containsDealKeywords(text, keywords = []) {
  if (!keywords.length) return true; // No keywords = always match
  
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Main fetch function - chooses static or rendered based on source config
 */
async function fetchDealSource(sourceConfig) {
  const { url, fetchMode = 'staticHtml', selectors, keywords } = sourceConfig;

  console.log(`[baseScraper] Fetching ${sourceConfig.id} (${fetchMode}): ${url}`);

  // Fetch HTML
  const fetchResult = fetchMode === 'renderedHtml' 
    ? await fetchRenderedHtml(url)
    : await fetchStaticHtml(url);

  if (!fetchResult.success) {
    return {
      sourceId: sourceConfig.id,
      success: false,
      error: fetchResult.error,
      url: fetchResult.url,
    };
  }

  // Extract structured content if selectors provided
  let extractedItems = [];
  if (selectors) {
    extractedItems = extractWithSelectors(fetchResult.html, selectors);
    console.log(`[baseScraper] Found ${extractedItems.length} items with selectors for ${sourceConfig.id}`);
    
    // Filter by keywords if provided
    if (keywords && keywords.length > 0) {
      const beforeFilter = extractedItems.length;
      extractedItems = extractedItems.filter(item => 
        containsDealKeywords(item.title + ' ' + item.description, keywords)
      );
      console.log(`[baseScraper] Filtered to ${extractedItems.length} items (from ${beforeFilter}) matching keywords`);
    }
  } else {
    console.warn(`[baseScraper] No selectors provided for ${sourceConfig.id} - cannot extract structured content`);
  }
  
  // If no items found, log a sample of the HTML for debugging
  if (extractedItems.length === 0 && fetchResult.html) {
    const sampleHtml = fetchResult.html.substring(0, 500);
    console.warn(`[baseScraper] No items extracted from ${sourceConfig.id}. HTML sample: ${sampleHtml}...`);
  }

  return {
    sourceId: sourceConfig.id,
    merchantName: sourceConfig.merchantName,
    city: sourceConfig.city,
    state: sourceConfig.state,
    category: sourceConfig.category,
    success: true,
    url: fetchResult.url,
    html: fetchResult.html,
    extractedItems,
    itemCount: extractedItems.length,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  fetchDealSource,
  fetchStaticHtml,
  fetchRenderedHtml,
  extractWithSelectors,
  containsDealKeywords,
};

