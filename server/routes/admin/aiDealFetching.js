/**
 * Admin API for AI Deal Fetching Agent
 * 
 * Endpoints:
 * - POST /admin/ai/fetch-deals - Trigger AI deal discovery
 * - POST /admin/ai/match-deals - Match existing deals to users with LLM
 */

const express = require('express');
const pool = require('../../config/database');
const { discoverDealsForPilotLocations, matchDealsToUser } = require('../../services/ai/dealFetchingAgent');
const { scrapeAndIngest } = require('../../services/scrapers/scraperService');
const { processIngestionJob } = require('../../services/ingestion');
const { fetchMidMichiganEvents } = require('../../services/aggregators/eventbrite');
const { searchBusinessesWithPosts } = require('../../services/aggregators/googlePlacesPosts');

const router = express.Router();

const ADMIN_HEADER = 'x-admin-token';
const adminToken = process.env.ADMIN_API_TOKEN;

const requireAdminToken = (req, res, next) => {
  console.log(`[admin/ai] Request received: ${req.method} ${req.path}`);
  console.log(`[admin/ai] Admin token configured: ${!!adminToken}`);
  console.log(`[admin/ai] Incoming header: ${req.header(ADMIN_HEADER) ? 'present' : 'missing'}`);
  
  if (!adminToken) {
    console.error('[admin/ai] ADMIN_API_TOKEN not configured');
    return res.status(500).json({
      data: null,
      error: { message: 'ADMIN_API_TOKEN not configured on server' },
      meta: {},
    });
  }

  const incoming = req.header(ADMIN_HEADER);
  if (!incoming || incoming !== adminToken) {
    console.warn(`[admin/ai] Unauthorized: token mismatch or missing`);
    return res.status(401).json({
      data: null,
      error: { message: 'Unauthorized' },
      meta: {},
    });
  }

  console.log('[admin/ai] Admin token validated, proceeding...');
  next();
};

// Log all requests to this router
router.use((req, res, next) => {
  console.log(`[admin/ai] Router middleware hit: ${req.method} ${req.path}`);
  console.log(`[admin/ai] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  next();
});

router.use(requireAdminToken);

// Trigger AI deal discovery
router.post('/fetch-deals', async (req, res) => {
  console.log('[admin/ai] /fetch-deals endpoint hit');
  console.log('[admin/ai] Request body:', JSON.stringify(req.body));
  
  try {
    const { categories, maxDealsPerLocation } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        data: null,
        error: { message: 'OPENAI_API_KEY not configured. Set it in environment variables.' },
        meta: {},
      });
    }

    console.log('[admin/ai] Starting AI deal discovery...');
    console.log('[admin/ai] OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

    let deals;
    try {
      deals = await discoverDealsForPilotLocations({
        categories: categories || ['Dining', 'Entertainment', 'Shopping'],
        maxDealsPerLocation: maxDealsPerLocation || 5,
      });
      console.log(`[admin/ai] Discovered ${deals.length} deals`);
    } catch (error) {
      console.error('[admin/ai] Discovery error:', error);
      return res.status(500).json({
        data: null,
        error: { 
          message: `AI discovery failed: ${error.message}`,
          details: error.response?.data || null,
        },
        meta: {},
      });
    }

    if (deals.length === 0) {
      console.log('[admin/ai] No deals discovered - LLM may have returned empty or invalid response');
      return res.json({
        data: {
          message: 'No deals discovered. Check server logs for details.',
          dealCount: 0,
        },
        error: null,
        meta: {},
      });
    }

    // Transform to ingestion format
    const ingestionDeals = deals.map(deal => ({
      merchantAlias: deal.merchantName || 'Unknown Merchant',
      rawPayload: {
        title: deal.title,
        description: deal.description,
        category: deal.category,
        address: deal.address,
        city: deal.city || deal.location?.split(',')[0],
        state: deal.state || 'MI',
        postalCode: deal.postalCode,
        latitude: deal.latitude,
        longitude: deal.longitude,
        startDate: deal.startDate,
        endDate: deal.endDate,
        price: deal.price,
        discountPercentage: deal.discountPercentage,
        sourceUrl: deal.sourceUrl,
      },
      normalizedPayload: {
        title: deal.title,
        category: deal.category,
        location: {
          city: deal.city || deal.location?.split(',')[0],
          state: deal.state || 'MI',
          latitude: deal.latitude,
          longitude: deal.longitude,
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
            amount: parseFloat(String(deal.price).replace('$', '')) || null,
          },
        } : {}),
      },
      confidence: deal.confidence || 0.75,
    }));

    const payload = {
      source: 'ai:deal-fetching-agent',
      scope: 'mid-michigan-pilot',
      deals: ingestionDeals,
    };

    console.log(`[admin/ai] Processing ${ingestionDeals.length} deals through ingestion pipeline...`);
    const result = await processIngestionJob(payload);
    console.log(`[admin/ai] Ingestion job completed:`, {
      jobId: result.jobId,
      stats: result.stats,
    });

    res.json({
      data: {
        message: 'AI deal discovery completed',
        dealCount: ingestionDeals.length,
        jobId: result.jobId,
        stats: result.stats,
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ai] fetch-deals error', error);
    res.status(500).json({
      data: null,
      error: { message: error.message || 'Failed to fetch deals with AI' },
      meta: {},
    });
  }
});

// Trigger web scraping deal discovery
router.post('/scrape-deals', async (req, res) => {
  console.log('[admin/ai] /scrape-deals endpoint hit');
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        data: null,
        error: { message: 'OPENAI_API_KEY not configured. Set it in environment variables.' },
        meta: {},
      });
    }

    console.log('[admin/ai] Starting web scraping deal discovery...');
    console.log('[admin/ai] This should ONLY produce deals with source "scraper:web"');

    let result;
    try {
      result = await scrapeAndIngest();
      
      // Verify the result has the correct source
      console.log('[admin/ai] Scraper result:', {
        success: result.success,
        sourcesScraped: result.sourcesScraped,
        dealsExtracted: result.dealsExtracted,
        dealsIngested: result.dealsIngested,
        error: result.error,
      });
      
      if (result.error) {
        console.error('[admin/ai] Scraper returned error:', result.error);
      }
      
      if (result.dealsExtracted === 0 && result.dealsIngested === 0) {
        console.warn('[admin/ai] WARNING: Scraper returned 0 deals. This means:');
        console.warn('[admin/ai] - No deals were found on the configured websites');
        console.warn('[admin/ai] - OR the scraper failed (check logs above)');
        console.warn('[admin/ai] - OR Playwright browsers may not be installed (check build logs)');
        console.warn('[admin/ai] - Any deals you see with source "ai" are from a DIFFERENT job (AI generation)');
        
        // Check if any sources failed due to Playwright
        const playwrightFailures = result.results?.filter(r => 
          r.error && r.error.includes('Playwright') && r.error.includes('Executable doesn\'t exist')
        ) || [];
        
        if (playwrightFailures.length > 0) {
          console.warn(`[admin/ai] ${playwrightFailures.length} sources failed due to missing Playwright browsers`);
          console.warn('[admin/ai] To fix: Check build logs for "Installing Chromium..." - if missing, Playwright browsers weren\'t installed');
        }
      }
    } catch (scrapeError) {
      console.error('[admin/ai] Scraping error details:', {
        message: scrapeError.message,
        stack: scrapeError.stack,
        code: scrapeError.code,
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to scrape deals from web';
      if (scrapeError.message.includes('ECONNREFUSED') || scrapeError.message.includes('Network Error')) {
        errorMessage = 'Network error: Could not connect to target websites. This may be due to network restrictions or the websites being unavailable.';
      } else if (scrapeError.message.includes('timeout')) {
        errorMessage = 'Request timeout: The scraping operation took too long. Some websites may be slow or unresponsive.';
      } else if (scrapeError.message.includes('ENOTFOUND') || scrapeError.message.includes('getaddrinfo')) {
        errorMessage = 'DNS error: Could not resolve website addresses. Check your network connection.';
      } else if (scrapeError.message) {
        errorMessage = `Scraping failed: ${scrapeError.message}`;
      }
      
      return res.status(500).json({
        data: null,
        error: { 
          message: errorMessage,
          details: scrapeError.message,
        },
        meta: {},
      });
    }

    // Build detailed summary of what happened
    const sourceSummary = result.results?.map(r => ({
      sourceId: r.sourceId,
      merchantName: r.merchantName,
      success: r.success,
      dealsFound: r.deals?.length || 0,
      itemsFound: r.itemCount || 0,
      error: r.error || null,
    })) || [];

    res.json({
      data: {
        message: result.dealsExtracted === 0 
          ? 'Web scraping completed but no deals were found. Check source details below.'
          : 'Web scraping completed',
        sourcesScraped: result.sourcesScraped,
        dealsExtracted: result.dealsExtracted,
        dealsIngested: result.dealsIngested,
        jobId: result.jobId,
        stats: result.stats,
        sourceDetails: sourceSummary, // Add detailed breakdown
        troubleshooting: result.dealsExtracted === 0 ? {
          possibleReasons: [
            'CSS selectors may not match the website structure (most likely)',
            'Websites may be blocking automated requests',
            'No deals currently available on the target websites',
            'Keywords filter may be too restrictive',
          ],
          nextSteps: [
            'Check server logs for HTML samples and suggested selectors',
            'Look for "[baseScraper] 💡 Found X potential selectors" messages',
            'Update selectors in server/config/dealSources.json to match actual HTML',
            'Test URLs manually in a browser to see current structure',
          ],
          note: 'All sources found 0 items, which suggests CSS selectors need updating. Check server logs for HTML samples and selector suggestions.',
        } : null,
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ai] scrape-deals error', error);
    res.status(500).json({
      data: null,
      error: { 
        message: error.message || 'Failed to scrape deals from web',
        details: error.stack,
      },
      meta: {},
    });
  }
});

// Fetch deals from Eventbrite
router.post('/fetch-eventbrite', async (req, res) => {
  console.log('[admin/ai] /fetch-eventbrite endpoint hit');
  
  try {
    if (!process.env.EVENTBRITE_API_TOKEN) {
      return res.status(400).json({
        data: null,
        error: { message: 'EVENTBRITE_API_TOKEN not configured. Set it in environment variables.' },
        meta: {},
      });
    }

    console.log('[admin/ai] Starting Eventbrite event fetching...');
    const deals = await fetchMidMichiganEvents({
      startDate: req.body.startDate || new Date().toISOString(),
      endDate: req.body.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (deals.length === 0) {
      return res.json({
        data: {
          message: 'No events found from Eventbrite.',
          dealCount: 0,
        },
        error: null,
        meta: {},
      });
    }

    // Ingest the deals
    const job = await processIngestionJob({
      source: 'eventbrite:api',
      scope: 'mid-michigan',
      deals,
    });

    console.log(`[admin/ai] Eventbrite ingestion job created: ${job.jobId}, ${deals.length} deals`);

    res.json({
      data: {
        message: `Eventbrite fetch completed! Found ${deals.length} events. They should appear below shortly.`,
        dealCount: deals.length,
        jobId: job.jobId,
        stats: job.stats,
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ai] Eventbrite fetch error:', error);
    return res.status(500).json({
      data: null,
      error: { 
        message: `Eventbrite fetch failed: ${error.message}`,
        details: error.response?.data || null,
      },
      meta: {},
    });
  }
});

// Fetch deals from Google Places posts
router.post('/fetch-google-places-posts', async (req, res) => {
  console.log('[admin/ai] /fetch-google-places-posts endpoint hit');
  
  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return res.status(400).json({
        data: null,
        error: { message: 'GOOGLE_PLACES_API_KEY not configured. Set it in environment variables.' },
        meta: {},
      });
    }

    const { query, city, state, maxResults = 20 } = req.body;
    
    if (!query || !city || !state) {
      return res.status(400).json({
        data: null,
        error: { message: 'query, city, and state are required' },
        meta: {},
      });
    }

    console.log(`[admin/ai] Starting Google Places posts search: "${query}" in ${city}, ${state}`);
    const businesses = await searchBusinessesWithPosts(query, city, state, {
      maxResults,
      postTypes: [req.body.postTypes || 'offer'],
    });

    if (businesses.length === 0) {
      return res.json({
        data: {
          message: 'No businesses found with posts.',
          dealCount: 0,
        },
        error: null,
        meta: {},
      });
    }

    // Convert to deals format
    const { convertPlaceToDeal } = require('../../services/aggregators/googlePlacesPosts');
    const deals = businesses.map(business => ({
      merchantAlias: business.placeName,
      rawPayload: {
        title: `Special Offer at ${business.placeName}`,
        description: `Check out ${business.placeName} for current promotions and special offers.`,
        category: 'Entertainment', // Will be mapped by category mapping system
        address: business.address,
        city: city,
        state: state,
        latitude: business.location?.lat,
        longitude: business.location?.lng,
        sourceUrl: business.website || `https://www.google.com/maps/place/?q=place_id:${business.placeId}`,
        placeId: business.placeId,
        sourceCategory: 'google_places',
        requiresValidation: true,
        syntheticDeal: true, // Mark as synthetic until we have real post data
      },
      normalizedPayload: {
        title: `Special Offer at ${business.placeName}`,
        description: `Check out ${business.placeName} for current promotions and special offers.`,
        category: 'Entertainment',
        location: {
          city: city,
          state: state,
          latitude: business.location?.lat,
          longitude: business.location?.lng,
        },
        sourceUrl: business.website || `https://www.google.com/maps/place/?q=place_id:${business.placeId}`,
      },
      confidence: 0.7,
    }));

    // Ingest the deals
    const job = await processIngestionJob({
      source: 'google_places_posts',
      scope: `${city}, ${state}`,
      deals,
    });

    console.log(`[admin/ai] Google Places posts ingestion job created: ${job.jobId}, ${deals.length} deals`);

    res.json({
      data: {
        message: `Google Places posts fetch completed! Found ${deals.length} businesses. They should appear below shortly.`,
        dealCount: deals.length,
        jobId: job.jobId,
        stats: job.stats,
        note: 'Note: These are placeholder deals. Real posts require Google My Business API access.',
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ai] Google Places posts fetch error:', error);
    return res.status(500).json({
      data: null,
      error: { 
        message: `Google Places posts fetch failed: ${error.message}`,
        details: error.response?.data || null,
      },
      meta: {},
    });
  }
});

module.exports = router;

