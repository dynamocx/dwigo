const express = require('express');
const multer = require('multer');
const pool = require('../../config/database');
const {
  promoteIngestedDealsByIds,
  rejectIngestedDealsByIds,
} = require('../../services/dealPromotion');
const { processIngestionJob } = require('../../services/ingestion');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const ADMIN_HEADER = 'x-admin-token';
const adminToken = process.env.ADMIN_API_TOKEN;

const requireAdminToken = (req, res, next) => {
  if (!adminToken) {
    return res.status(500).json({
      data: null,
      error: { message: 'ADMIN_API_TOKEN not configured on server' },
      meta: {},
    });
  }

  const incoming = req.header(ADMIN_HEADER);
  if (!incoming || incoming !== adminToken) {
    return res.status(401).json({
      data: null,
      error: { message: 'Unauthorized' },
      meta: {},
    });
  }

  next();
};

router.use(requireAdminToken);

router.get('/pending', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    console.log(`[admin/ingestion] Fetching pending rows (limit: ${limit})`);

    const { rows } = await pool.query(
      `
        SELECT r.*,
               j.source AS job_source,
               j.scope AS job_scope,
               j.started_at AS job_started_at,
               j.finished_at AS job_finished_at
        FROM ingested_deal_raw r
        LEFT JOIN ingestion_jobs j ON j.id = r.job_id
        WHERE r.status = 'pending'
        ORDER BY r.id ASC
        LIMIT $1
      `,
      [limit]
    );

    console.log(`[admin/ingestion] Found ${rows.length} pending rows`);

    // Also get stats on auto-rejected deals for context
    const { rows: rejectedStats } = await pool.query(
      `
        SELECT COUNT(*) as count
        FROM ingested_deal_raw
        WHERE status = 'auto_rejected'
          AND created_at > NOW() - INTERVAL '7 days'
      `
    );

    res.json({
      data: rows,
      error: null,
      meta: { 
        total: rows.length,
        autoRejectedLast7Days: Number(rejectedStats[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('[admin/ingestion] pending fetch error', error);
    console.error('[admin/ingestion] Error stack:', error.stack);
    res.status(500).json({
      data: [],
      error: { 
        message: 'Failed to load pending ingestion rows',
        details: error.message,
      },
      meta: {},
    });
  }
});

router.post('/promote', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    const stats = await promoteIngestedDealsByIds(ids);

    res.json({
      data: stats,
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] promote error', error);
    res.status(500).json({
      data: null,
      error: { message: 'Failed to promote ingestion rows' },
      meta: {},
    });
  }
});

router.post('/reject', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    const result = await rejectIngestedDealsByIds(ids);

    res.json({
      data: result,
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] reject error', error);
    res.status(500).json({
      data: null,
      error: { message: 'Failed to reject ingestion rows' },
      meta: {},
    });
  }
});

router.get('/debug/deals', async (req, res) => {
  try {
    // Get all deals with their merchant info
    const { rows: allDeals } = await pool.query(`
      SELECT 
        d.id,
        d.title,
        d.status,
        d.category,
        d.end_date,
        d.created_at,
        d.merchant_id,
        m.business_name,
        CASE 
          WHEN d.end_date IS NULL THEN 'no end date'
          WHEN d.end_date > NOW() THEN 'future'
          ELSE 'past'
        END as end_date_status,
        CASE 
          WHEN m.id IS NULL THEN 'no merchant'
          ELSE 'has merchant'
        END as merchant_status
      FROM deals d
      LEFT JOIN merchants m ON d.merchant_id = m.id
      ORDER BY d.created_at DESC
      LIMIT 20
    `);

    // Get deals that should appear in the main query
    const { rows: visibleDeals } = await pool.query(`
      SELECT d.id, d.title, d.status, d.category, d.end_date, m.business_name
      FROM deals d
      INNER JOIN merchants m ON d.merchant_id = m.id
      WHERE d.status = 'active' AND (d.end_date IS NULL OR d.end_date > NOW())
      ORDER BY d.created_at DESC
      LIMIT 20
    `);

    res.json({
      data: {
        allDeals,
        visibleDeals,
        summary: {
          total: allDeals.length,
          visible: visibleDeals.length,
          hidden: allDeals.length - visibleDeals.length,
        },
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] debug error', error);
    res.status(500).json({
      data: null,
      error: { message: 'Failed to debug deals' },
      meta: {},
    });
  }
});

router.post('/seed-mid-michigan', async (req, res) => {
  try {
    const { processIngestionJob } = require('../../services/ingestion');
    
    const MID_MICHIGAN_DEALS = [
      // Lansing Area
      {
        merchantAlias: 'Lansing Brewing Company',
        rawPayload: {
          title: 'Michigan Mondays – 15% Off Local Pours',
          description: 'Celebrate the Mitten every Monday with 15% off all Michigan-made drafts and flights.',
          category: 'Dining',
          address: '518 E Shiawassee St',
          city: 'Lansing',
          state: 'MI',
          postalCode: '48912',
          latitude: 42.7325,
          longitude: -84.5555,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.lansingbrewingcompany.com',
        },
        normalizedPayload: {
          title: 'Michigan Mondays – 15% Off Local Pours',
          category: 'Dining',
          discount: { type: 'percentage', value: 15 },
          location: { city: 'Lansing', state: 'MI', latitude: 42.7325, longitude: -84.5555 },
        },
        confidence: 0.85,
      },
      {
        merchantAlias: 'Horrocks Farm Market',
        rawPayload: {
          title: 'Winter Wine Walk & Cheese Pairings',
          description: 'Stroll the greenhouse with live acoustic music, sample 6 curated wine and cheese pairings.',
          category: 'Entertainment',
          address: '7420 W Saginaw Hwy',
          city: 'Lansing',
          state: 'MI',
          postalCode: '48917',
          latitude: 42.7325,
          longitude: -84.5555,
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          price: 25,
          sourceUrl: 'https://www.shophorrocks.com',
        },
        normalizedPayload: {
          title: 'Winter Wine Walk & Cheese Pairings',
          category: 'Entertainment',
          price: { currency: 'USD', amount: 25 },
          location: { city: 'Lansing', state: 'MI', latitude: 42.7325, longitude: -84.5555 },
        },
        confidence: 0.8,
      },
      {
        merchantAlias: 'The Soup Spoon Cafe',
        rawPayload: {
          title: 'Happy Hour Specials',
          description: 'Half-price appetizers and $2 off craft cocktails, Monday-Friday 3-6 PM.',
          category: 'Dining',
          address: '1419 E Grand River Ave',
          city: 'Lansing',
          state: 'MI',
          postalCode: '48906',
          latitude: 42.7325,
          longitude: -84.5555,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.soupspooncafe.com',
        },
        normalizedPayload: {
          title: 'Happy Hour Specials',
          category: 'Dining',
          discount: { type: 'percentage', value: 50 },
          location: { city: 'Lansing', state: 'MI', latitude: 42.7325, longitude: -84.5555 },
        },
        confidence: 0.75,
      },
      // Flint Area
      {
        merchantAlias: 'The Torch Bar & Grill',
        rawPayload: {
          title: 'Taco Tuesday – $2 Tacos',
          description: 'Every Tuesday, enjoy $2 tacos all day long. Choose from beef, chicken, or vegetarian options.',
          category: 'Dining',
          address: '701 S Saginaw St',
          city: 'Flint',
          state: 'MI',
          postalCode: '48502',
          latitude: 43.0125,
          longitude: -83.6875,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.torchbar.com',
        },
        normalizedPayload: {
          title: 'Taco Tuesday – $2 Tacos',
          category: 'Dining',
          price: { currency: 'USD', amount: 2 },
          location: { city: 'Flint', state: 'MI', latitude: 43.0125, longitude: -83.6875 },
        },
        confidence: 0.8,
      },
      {
        merchantAlias: 'Sloan Museum',
        rawPayload: {
          title: 'Free Admission First Friday',
          description: 'Free admission to Sloan Museum on the first Friday of each month, 5-8 PM.',
          category: 'Entertainment',
          address: '1221 E Kearsley St',
          city: 'Flint',
          state: 'MI',
          postalCode: '48503',
          latitude: 43.0125,
          longitude: -83.6875,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.sloanlongway.org',
        },
        normalizedPayload: {
          title: 'Free Admission First Friday',
          category: 'Entertainment',
          discount: { type: 'percentage', value: 100 },
          location: { city: 'Flint', state: 'MI', latitude: 43.0125, longitude: -83.6875 },
        },
        confidence: 0.85,
      },
      // Grand Blanc Area
      {
        merchantAlias: 'Genesee Valley Center',
        rawPayload: {
          title: 'Weekend Shopping Specials',
          description: 'Save 20% on select stores throughout the mall. Valid Friday-Sunday.',
          category: 'Shopping',
          address: '3341 S Linden Rd',
          city: 'Flint',
          state: 'MI',
          postalCode: '48507',
          latitude: 42.9275,
          longitude: -83.6169,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.geneseevalleycenter.com',
        },
        normalizedPayload: {
          title: 'Weekend Shopping Specials',
          category: 'Shopping',
          discount: { type: 'percentage', value: 20 },
          location: { city: 'Grand Blanc', state: 'MI', latitude: 42.9275, longitude: -83.6169 },
        },
        confidence: 0.7,
      },
      // Fenton Area
      {
        merchantAlias: 'The Fenton Hotel',
        rawPayload: {
          title: 'Sunday Brunch Buffet',
          description: 'All-you-can-eat brunch buffet every Sunday 10 AM - 2 PM. $18.99 per person.',
          category: 'Dining',
          address: '100 N Leroy St',
          city: 'Fenton',
          state: 'MI',
          postalCode: '48430',
          latitude: 42.7978,
          longitude: -83.7050,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.fentonhotel.com',
        },
        normalizedPayload: {
          title: 'Sunday Brunch Buffet',
          category: 'Dining',
          price: { currency: 'USD', amount: 18.99 },
          location: { city: 'Fenton', state: 'MI', latitude: 42.7978, longitude: -83.7050 },
        },
        confidence: 0.75,
      },
      {
        merchantAlias: 'Fenton Winery & Brewery',
        rawPayload: {
          title: 'Wine Tasting Flight Special',
          description: '5-wine tasting flight for $12 (regularly $15). Available daily.',
          category: 'Entertainment',
          address: '1370 N Long Lake Rd',
          city: 'Fenton',
          state: 'MI',
          postalCode: '48430',
          latitude: 42.7978,
          longitude: -83.7050,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.fentonwinery.com',
        },
        normalizedPayload: {
          title: 'Wine Tasting Flight Special',
          category: 'Entertainment',
          discount: { type: 'percentage', value: 20 },
          location: { city: 'Fenton', state: 'MI', latitude: 42.7978, longitude: -83.7050 },
        },
        confidence: 0.8,
      },
    ];

    const payload = {
      source: 'admin-seed',
      scope: 'mid-michigan-initial',
      deals: MID_MICHIGAN_DEALS,
    };

    const result = await processIngestionJob(payload);

    res.json({
      data: {
        message: 'Mid-Michigan deals seeded successfully',
        dealCount: MID_MICHIGAN_DEALS.length,
        jobId: result.jobId,
        stats: result.stats,
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] seed-mid-michigan error', error);
    res.status(500).json({
      data: null,
      error: { message: error.message || 'Failed to seed Mid-Michigan deals' },
      meta: {},
    });
  }
});

router.post('/seed', async (req, res) => {
  try {
    const sampleDeals = [
      {
        merchantAlias: 'Lansing Brewing Company',
        rawPayload: {
          title: 'Michigan Mondays – 15% Off Local Pours',
          description: 'Celebrate the Mitten every Monday with 15% off all Michigan-made drafts and flights.',
          category: 'Restaurants',
          address: '518 E Shiawassee St, Lansing, MI 48912',
          city: 'Lansing',
          state: 'MI',
          postalCode: '48912',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.lansingbrewingcompany.com/events',
        },
        normalizedPayload: {
          title: 'Michigan Mondays – 15% Off Local Pours',
          category: 'Restaurants',
          location: {
            city: 'Lansing',
            state: 'MI',
          },
          schedule: {
            type: 'recurring_weekly',
            rule: {
              daysOfWeek: ['monday'],
              startTime: '16:00',
              endTime: '21:00',
            },
          },
          discount: {
            type: 'percentage',
            value: 15,
          },
        },
        confidence: 0.8,
      },
      {
        merchantAlias: 'Horrocks Farm Market',
        rawPayload: {
          title: 'Winter Wine Walk & Cheese Pairings',
          description: 'Stroll the greenhouse with live acoustic music, sample 6 curated wine and cheese pairings.',
          category: 'Entertainment',
          address: '7420 W Saginaw Hwy, Lansing, MI 48917',
          city: 'Lansing',
          state: 'MI',
          postalCode: '48917',
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          price: 25,
          sourceUrl: 'https://www.shophorrocks.com/events',
        },
        normalizedPayload: {
          title: 'Winter Wine Walk & Cheese Pairings',
          category: 'Entertainment',
          price: {
            currency: 'USD',
            amount: 25,
          },
          location: {
            city: 'Lansing',
            state: 'MI',
          },
          schedule: {
            type: 'one_time',
            rule: {
              startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
            },
          },
        },
        confidence: 0.7,
      },
    ];

    const payload = {
      source: 'admin-seed',
      scope: 'test-deals',
      deals: sampleDeals,
    };

    // Process the ingestion job directly (since we don't have a worker service on free tier)
    const result = await processIngestionJob(payload);

    res.json({
      data: { 
        message: 'Ingestion job processed', 
        dealCount: sampleDeals.length,
        jobId: result.jobId,
        stats: result.stats,
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] seed error', error);
    res.status(500).json({
      data: null,
      error: { message: 'Failed to seed ingestion job' },
      meta: {},
    });
  }
});

// Configure multer for CSV uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

// Manual deal entry endpoint
router.post('/manual-entry', async (req, res) => {
  try {
    const { processIngestionJob } = require('../../services/ingestion');
    
    const {
      merchantAlias,
      title,
      description,
      category,
      address,
      city,
      state,
      postalCode,
      latitude,
      longitude,
      startDate,
      endDate,
      price,
      discountPercentage,
      sourceUrl,
      confidence = 0.75,
    } = req.body;

    if (!merchantAlias || !title || !category) {
      return res.status(400).json({
        data: null,
        error: { message: 'merchantAlias, title, and category are required' },
        meta: {},
      });
    }

    const rawPayload = {
      title,
      description,
      category,
      address,
      city,
      state,
      postalCode,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      startDate,
      endDate,
      sourceUrl,
    };

    if (price) {
      rawPayload.price = parseFloat(price);
    }
    if (discountPercentage) {
      rawPayload.discountPercentage = parseFloat(discountPercentage);
    }

    const normalizedPayload = {
      title,
      category,
      location: {
        city,
        state,
        ...(latitude && longitude ? {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        } : {}),
      },
    };

    if (discountPercentage) {
      normalizedPayload.discount = {
        type: 'percentage',
        value: parseFloat(discountPercentage),
      };
    } else if (price) {
      normalizedPayload.price = {
        currency: 'USD',
        amount: parseFloat(price),
      };
    }

    const deal = {
      merchantAlias,
      rawPayload,
      normalizedPayload,
      confidence: parseFloat(confidence),
    };

    const payload = {
      source: 'admin-manual-entry',
      scope: 'mid-michigan-pilot',
      deals: [deal],
    };

    const result = await processIngestionJob(payload);

    res.json({
      data: {
        message: 'Deal entered successfully',
        dealCount: 1,
        jobId: result.jobId,
        stats: result.stats,
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] manual-entry error', error);
    res.status(500).json({
      data: null,
      error: { message: error.message || 'Failed to enter deal' },
      meta: {},
    });
  }
});

// CSV upload endpoint
router.post('/upload-csv', upload.single('csv'), async (req, res) => {
  try {
    const { processIngestionJob } = require('../../services/ingestion');
    
    if (!req.file) {
      return res.status(400).json({
        data: null,
        error: { message: 'CSV file is required' },
        meta: {},
      });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return res.status(400).json({
        data: null,
        error: { message: 'CSV must have at least a header row and one data row' },
        meta: {},
      });
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const deals = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length || values.every(v => !v)) {
        continue; // Skip empty or malformed rows
      }

      const deal = {};
      headers.forEach((header, index) => {
        const value = values[index];
        if (value && value !== '') {
          if (header === 'latitude' || header === 'longitude') {
            deal[header] = parseFloat(value);
          } else if (header === 'price' || header === 'discountPercentage' || header === 'confidence') {
            deal[header] = parseFloat(value);
          } else {
            deal[header] = value;
          }
        }
      });

      if (!deal.merchantAlias || !deal.title || !deal.category) {
        continue; // Skip rows missing required fields
      }

      const rawPayload = {
        title: deal.title,
        description: deal.description,
        category: deal.category,
        address: deal.address,
        city: deal.city,
        state: deal.state,
        postalCode: deal.postalCode,
        latitude: deal.latitude,
        longitude: deal.longitude,
        startDate: deal.startDate,
        endDate: deal.endDate,
        sourceUrl: deal.sourceUrl,
      };

      if (deal.price) {
        rawPayload.price = deal.price;
      }
      if (deal.discountPercentage) {
        rawPayload.discountPercentage = deal.discountPercentage;
      }

      const normalizedPayload = {
        title: deal.title,
        category: deal.category,
        location: {
          city: deal.city,
          state: deal.state,
          ...(deal.latitude && deal.longitude ? {
            latitude: deal.latitude,
            longitude: deal.longitude,
          } : {}),
        },
      };

      if (deal.discountPercentage) {
        normalizedPayload.discount = {
          type: 'percentage',
          value: deal.discountPercentage,
        };
      } else if (deal.price) {
        normalizedPayload.price = {
          currency: 'USD',
          amount: deal.price,
        };
      }

      deals.push({
        merchantAlias: deal.merchantAlias,
        rawPayload,
        normalizedPayload,
        confidence: deal.confidence || 0.75,
      });
    }

    if (deals.length === 0) {
      return res.status(400).json({
        data: null,
        error: { message: 'No valid deals found in CSV' },
        meta: {},
      });
    }

    const payload = {
      source: 'admin-csv-upload',
      scope: 'mid-michigan-pilot',
      deals,
    };

    const result = await processIngestionJob(payload);

    res.json({
      data: {
        message: 'CSV imported successfully',
        dealCount: deals.length,
        jobId: result.jobId,
        stats: result.stats,
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] upload-csv error', error);
    res.status(500).json({
      data: null,
      error: { message: error.message || 'Failed to import CSV' },
      meta: {},
    });
  }
});

module.exports = router;


