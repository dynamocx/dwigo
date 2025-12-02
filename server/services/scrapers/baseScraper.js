/**
 * Base Scraper Service
 * 
 * Handles fetching HTML from merchant websites using:
 * - Static HTML (axios + cheerio) for simple pages
 * - Rendered HTML (Playwright) for JavaScript-heavy pages
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Playwright is optional - only needed for renderedHtml mode
let chromium = null;
try {
  const playwright = require('playwright');
  chromium = playwright.chromium;
  console.log('[baseScraper] Playwright loaded successfully');
} catch (error) {
  console.warn('[baseScraper] Playwright not available:', error.message);
  console.warn('[baseScraper] Rendered HTML scraping will fail. Install with: npm install playwright && npx playwright install chromium');
}

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
      validateStatus: (status) => status < 500, // Accept 4xx but not 5xx
    });

    return {
      success: true,
      html: response.data,
      url: response.request.res.responseUrl || url, // Final URL after redirects
      statusCode: response.status,
    };
  } catch (error) {
    // Provide more detailed error information
    const errorDetails = {
      message: error.message,
      code: error.code,
      url,
    };
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorDetails.message = `Network error: Could not connect to ${url}. ${error.message}`;
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      errorDetails.message = `Request timeout: ${url} did not respond within ${timeout}ms`;
    } else if (error.response) {
      errorDetails.message = `HTTP ${error.response.status}: ${error.response.statusText}`;
      errorDetails.statusCode = error.response.status;
    }
    
    console.error(`[baseScraper] Static fetch error for ${url}:`, errorDetails);
    return {
      success: false,
      error: errorDetails.message,
      url,
      errorCode: error.code,
    };
  }
}

/**
 * Fetch rendered HTML using Playwright (for JavaScript-heavy pages)
 */
async function fetchRenderedHtml(url, timeout = 30000) {
  let browser = null;
  try {
    // Check if Playwright is available
    if (!chromium) {
      throw new Error('Playwright chromium not available. Run: npm install playwright && npx playwright install chromium');
    }
    
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
      try {
        await browser.close();
      } catch (closeError) {
        console.warn('[baseScraper] Error closing browser:', closeError.message);
      }
    }
    
    // Provide more detailed error information
    const errorDetails = {
      message: error.message,
      code: error.code || error.name,
      url,
    };
    
    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED') || error.message.includes('getaddrinfo')) {
      errorDetails.message = `DNS error: Could not resolve ${url}. Check the URL is correct.`;
    } else if (error.message.includes('timeout') || error.message.includes('Navigation timeout')) {
      errorDetails.message = `Navigation timeout: ${url} did not load within ${timeout}ms`;
    } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      errorDetails.message = `Connection refused: ${url} is not accepting connections`;
    } else if (error.message.includes('Playwright')) {
      errorDetails.message = `Playwright error: ${error.message}. Playwright may not be installed or configured correctly.`;
    }
    
    console.error(`[baseScraper] Rendered fetch error for ${url}:`, errorDetails);
    return {
      success: false,
      error: errorDetails.message,
      url,
      errorCode: error.code || error.name,
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

