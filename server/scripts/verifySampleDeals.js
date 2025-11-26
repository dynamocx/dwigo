/**
 * Verification script to check if sample deals exist on merchant websites
 * This helps identify which deals are real vs. fictional examples
 */

const axios = require('axios');
const cheerio = require('cheerio');

const SAMPLE_DEALS = [
  {
    merchant: 'The Soup Spoon Cafe',
    url: 'https://www.soupspooncafe.com',
    deal: 'Half-price appetizers and $2 off craft cocktails, Monday-Friday 3-6 PM',
    searchTerms: ['happy hour', 'appetizer', 'cocktail', '3-6', 'monday-friday'],
  },
  {
    merchant: 'Lansing Brewing Company',
    url: 'https://www.lansingbrewingcompany.com',
    deal: 'Michigan Mondays – 15% Off Local Pours',
    searchTerms: ['michigan monday', '15%', 'local', 'pour'],
  },
  {
    merchant: 'Horrocks Farm Market',
    url: 'https://www.shophorrocks.com',
    deal: 'Winter Wine Walk & Cheese Pairings',
    searchTerms: ['wine walk', 'cheese', 'pairing'],
  },
  {
    merchant: 'The Torch Bar & Grill',
    url: 'https://www.torchbar.com',
    deal: 'Taco Tuesday – $2 Tacos',
    searchTerms: ['taco tuesday', '$2', 'taco'],
  },
  {
    merchant: 'Sloan Museum',
    url: 'https://www.sloanlongway.org',
    deal: 'Free Admission First Friday',
    searchTerms: ['first friday', 'free', 'admission'],
  },
];

async function verifyDeal(dealInfo) {
  try {
    console.log(`\n🔍 Checking: ${dealInfo.merchant}`);
    console.log(`   Deal: ${dealInfo.deal}`);
    console.log(`   URL: ${dealInfo.url}`);

    const { data: html } = await axios.get(dealInfo.url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DWIGO-Verification/1.0)',
      },
    });

    const $ = cheerio.load(html);
    const pageText = $('body').text().toLowerCase();

    const foundTerms = dealInfo.searchTerms.filter(term => 
      pageText.includes(term.toLowerCase())
    );

    if (foundTerms.length > 0) {
      console.log(`   ✅ Found matching terms: ${foundTerms.join(', ')}`);
      return { merchant: dealInfo.merchant, status: 'possibly_real', foundTerms };
    } else {
      console.log(`   ⚠️  No matching terms found`);
      return { merchant: dealInfo.merchant, status: 'not_found', foundTerms: [] };
    }
  } catch (error) {
    console.log(`   ❌ Error checking: ${error.message}`);
    return { merchant: dealInfo.merchant, status: 'error', error: error.message };
  }
}

async function main() {
  console.log('🔎 Verifying Sample Deals\n');
  console.log('This script checks if the sample deals appear on merchant websites.');
  console.log('Note: This is a basic check - deals may exist but not be listed online.\n');

  const results = [];

  for (const deal of SAMPLE_DEALS) {
    const result = await verifyDeal(deal);
    results.push(result);
    // Be polite - wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n📊 Summary:');
  console.log('─'.repeat(50));
  results.forEach(result => {
    const icon = result.status === 'possibly_real' ? '✅' : result.status === 'not_found' ? '⚠️' : '❌';
    console.log(`${icon} ${result.merchant}: ${result.status}`);
  });

  console.log('\n💡 Next Steps:');
  console.log('   - If deals are "not_found", they may be fictional examples');
  console.log('   - Consider replacing with verified deals from merchant websites');
  console.log('   - Or build crawlers to automatically fetch real deals');
}

void main();

