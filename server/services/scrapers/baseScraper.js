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
    
    // Try to launch browser - this will fail if browsers aren't installed
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        // Explicitly set executable path if PLAYWRIGHT_BROWSERS_PATH is set
        executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ? 
          `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium-1200/chrome-linux64/chrome` : 
          undefined,
      });
      console.log('[baseScraper] Playwright browser launched successfully');
    } catch (launchError) {
      // Log the actual error for debugging
      console.error('[baseScraper] Playwright launch error:', {
        message: launchError.message,
        code: launchError.code,
        name: launchError.name,
        stack: launchError.stack?.substring(0, 500),
      });
      
      // Check if it's a browser installation error
      if (launchError.message && (
        launchError.message.includes('Executable doesn\'t exist') || 
        launchError.message.includes('browserType.launch') ||
        launchError.message.includes('BrowserType.launch') ||
        launchError.message.includes('executable doesn\'t exist')
      )) {
        throw new Error('Playwright browsers not installed. Run: npx playwright install chromium. Playwright may not be installed or configured correctly.');
      }
      throw launchError; // Re-throw other errors
    }

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
    
    // Check for Cloudflare challenge page
    const title = await page.title();
    const html = await page.content();
    
    if (title.includes('Just a moment') || html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
      console.warn(`[baseScraper] Cloudflare challenge detected for ${url} - waiting for challenge to complete...`);
      
      // Wait for Cloudflare challenge to complete (up to 10 seconds)
      try {
        await page.waitForFunction(
          () => !document.title.includes('Just a moment') && !document.body.innerHTML.includes('cf-browser-verification'),
          { timeout: 10000 }
        );
        // Re-fetch HTML after challenge completes
        const finalHtml = await page.content();
        const finalUrl = page.url();
        console.log(`[baseScraper] Cloudflare challenge completed for ${url}`);
        return {
          success: true,
          html: finalHtml,
          url: finalUrl,
          statusCode: 200,
        };
      } catch (cfError) {
        console.warn(`[baseScraper] Cloudflare challenge did not complete within timeout for ${url}`);
        // Return the challenge page HTML anyway - it will be detected later
      }
    }
    
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

  // Fetch HTML - try renderedHtml first if requested, fallback to staticHtml if Playwright fails
  let fetchResult;
  if (fetchMode === 'renderedHtml') {
    try {
      fetchResult = await fetchRenderedHtml(url);
      // If Playwright fails, fallback to staticHtml
      if (!fetchResult.success && fetchResult.error && fetchResult.error.includes('Playwright')) {
        console.warn(`[baseScraper] Playwright failed for ${sourceConfig.id}, falling back to staticHtml`);
        fetchResult = await fetchStaticHtml(url);
      }
    } catch (error) {
      // Playwright not available or other error - fallback to staticHtml
      console.warn(`[baseScraper] RenderedHtml failed for ${sourceConfig.id}: ${error.message}. Falling back to staticHtml`);
      fetchResult = await fetchStaticHtml(url);
    }
  } else {
    fetchResult = await fetchStaticHtml(url);
  }

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
  
  // Check for Cloudflare challenge page
  if (fetchResult.html && (fetchResult.html.includes('Just a moment') || fetchResult.html.includes('cf-browser-verification'))) {
    console.warn(`[baseScraper] ⚠️  Cloudflare protection detected for ${sourceConfig.id} (${sourceConfig.merchantName})`);
    console.warn(`[baseScraper] This website is blocking automated requests. Playwright may have bypassed it, but if you see 0 items, Cloudflare is likely blocking.`);
    console.warn(`[baseScraper] Consider: 1) Using a different source URL, 2) Contacting the website owner, 3) Using their API if available`);
  }
  
  // If no items found, log detailed debugging info
  if (extractedItems.length === 0 && fetchResult.html) {
    const sampleHtml = fetchResult.html.substring(0, 1000);
    console.warn(`[baseScraper] ⚠️  No items extracted from ${sourceConfig.id} (${sourceConfig.merchantName})`);
    console.warn(`[baseScraper] URL: ${fetchResult.url}`);
    console.warn(`[baseScraper] HTML length: ${fetchResult.html.length} characters`);
    console.warn(`[baseScraper] Selectors used:`, JSON.stringify(selectors, null, 2));
    console.warn(`[baseScraper] HTML sample (first 1000 chars):`);
    console.warn(sampleHtml);
    console.warn(`[baseScraper] --- End HTML sample for ${sourceConfig.id} ---`);
    
    // Try to find common deal-related elements as a hint
    const $ = cheerio.load(fetchResult.html);
    const possibleSelectors = [
      'article', '.card', '.item', '.post', '.event', 
      '.deal', '.special', '.promotion', '.offer',
      '[class*="deal"]', '[class*="event"]', '[class*="special"]'
    ];
    
    const foundElements = [];
    possibleSelectors.forEach(selector => {
      const count = $(selector).length;
      if (count > 0) {
        foundElements.push({ selector, count });
      }
    });
    
    if (foundElements.length > 0) {
      console.warn(`[baseScraper] 💡 Found ${foundElements.length} potential selectors in HTML:`);
      foundElements.forEach(({ selector, count }) => {
        console.warn(`[baseScraper]   - "${selector}": ${count} elements found`);
      });
    } else {
      console.warn(`[baseScraper] 💡 No common deal-related elements found. Website structure may be different.`);
    }
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

