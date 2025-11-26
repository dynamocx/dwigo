/**
 * CSV Import Utility for Bulk Deal Seeding
 * 
 * Usage:
 *   node scripts/importDealsFromCSV.js <path-to-csv-file>
 * 
 * CSV Format (headers required):
 *   merchantAlias,title,description,category,address,city,state,postalCode,latitude,longitude,
 *   startDate,endDate,price,discountPercentage,sourceUrl,confidence
 * 
 * Example:
 *   node scripts/importDealsFromCSV.js data/mid-michigan-deals.csv
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { processIngestionJob } = require('../services/ingestion');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const deals = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      console.warn(`Skipping row ${i + 1}: column count mismatch`);
      continue;
    }

    const deal = {};
    headers.forEach((header, index) => {
      const value = values[index];
      if (value && value !== '') {
        // Handle nested fields
        if (header === 'latitude' || header === 'longitude') {
          deal[header] = parseFloat(value);
        } else if (header === 'price' || header === 'discountPercentage' || header === 'confidence') {
          deal[header] = parseFloat(value);
        } else {
          deal[header] = value;
        }
      }
    });

    // Build normalized payload structure
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
      confidence: deal.confidence ? parseFloat(deal.confidence) : 0.75,
    });
  }

  return deals;
}

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('Usage: node scripts/importDealsFromCSV.js <path-to-csv-file>');
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), csvPath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`Error: CSV file not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`[importDealsFromCSV] Reading CSV from: ${fullPath}`);

  try {
    const deals = parseCSV(fullPath);
    console.log(`[importDealsFromCSV] Parsed ${deals.length} deals from CSV`);

    if (deals.length === 0) {
      console.warn('[importDealsFromCSV] No deals found in CSV');
      process.exit(0);
    }

    const payload = {
      source: 'csv-import',
      scope: 'mid-michigan-pilot',
      deals,
    };

    const result = await processIngestionJob(payload);

    console.log('[importDealsFromCSV] Import job completed:', {
      jobId: result.jobId,
      stats: result.stats,
    });

    console.log('\n[importDealsFromCSV] Next steps:');
    console.log('  1. Review deals at /admin/ingestion/pending');
    console.log('  2. Promote approved deals using the admin UI or API');
    console.log('  3. Deals will appear in the app once promoted');

    process.exit(0);
  } catch (error) {
    console.error('[importDealsFromCSV] Import failed:', error);
    process.exit(1);
  }
}

void main();

