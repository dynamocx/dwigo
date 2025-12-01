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

    let result;
    try {
      result = await scrapeAndIngest();
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

    res.json({
      data: {
        message: 'Web scraping completed',
        sourcesScraped: result.sourcesScraped,
        dealsExtracted: result.dealsExtracted,
        dealsIngested: result.dealsIngested,
        jobId: result.jobId,
        stats: result.stats,
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

module.exports = router;

