/**
 * Deal Fetching Agent - AI-Native Deal Discovery
 * 
 * Uses LLM with function calling to:
 * 1. Discover deals from web sources for pilot locations
 * 2. Extract and normalize deal information
 * 3. Match deals to user preferences and behaviors
 * 4. Score and rank deals for personalized feed
 * 
 * Architecture:
 * - OpenAI Responses API with function calling (fastest path)
 * - Tools: search_deals, extract_deal_info, match_to_user, score_deal
 * - Context: user preferences, geography, recent behaviors
 */

const axios = require('axios');
const cheerio = require('cheerio');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

// Pilot locations for Mid-Michigan
const PILOT_LOCATIONS = [
  { name: 'Lansing, MI', latitude: 42.7325, longitude: -84.5555, radius: 15 },
  { name: 'Flint, MI', latitude: 43.0125, longitude: -83.6875, radius: 15 },
  { name: 'Grand Blanc, MI', latitude: 42.9275, longitude: -83.6169, radius: 15 },
  { name: 'Fenton, MI', latitude: 42.7978, longitude: -83.7050, radius: 15 },
];

/**
 * Tool definitions for LLM function calling
 */
const DEAL_FETCHING_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_web_for_deals',
      description: 'Search the web for deals in a specific location and category. Returns URLs and basic info about potential deal sources.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name (e.g., "Lansing, MI")',
          },
          category: {
            type: 'string',
            description: 'Deal category (e.g., "Dining", "Entertainment", "Shopping")',
          },
          query: {
            type: 'string',
            description: 'Search query for deals (e.g., "happy hour", "discount", "special offer")',
          },
        },
        required: ['location', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_deal_from_url',
      description: 'Extract deal information from a web page URL. Returns structured deal data.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL of the page containing deal information',
          },
          merchantName: {
            type: 'string',
            description: 'Name of the merchant/business',
          },
          category: {
            type: 'string',
            description: 'Expected deal category',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'match_deal_to_user',
      description: 'Score how well a deal matches a user\'s preferences, geography, and behaviors.',
      parameters: {
        type: 'object',
        properties: {
          deal: {
            type: 'object',
            description: 'Deal object with title, description, category, location, price, etc.',
          },
          userPreferences: {
            type: 'object',
            description: 'User preferences (categories, brands, locations)',
          },
          userLocation: {
            type: 'object',
            description: 'User current location (latitude, longitude)',
          },
          userBehaviors: {
            type: 'object',
            description: 'User behaviors (saved deals, viewed deals, redeemed deals)',
          },
        },
        required: ['deal', 'userPreferences'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'score_deal_quality',
      description: 'Score the quality and completeness of a deal for ingestion.',
      parameters: {
        type: 'object',
        properties: {
          deal: {
            type: 'object',
            description: 'Deal object to score',
          },
        },
        required: ['deal'],
      },
    },
  },
];

/**
 * Tool implementations
 */
const toolImplementations = {
  search_web_for_deals: async ({ location, category, query }) => {
    // In production, this would use a search API (Google Custom Search, SerpAPI, etc.)
    // For now, return structured search suggestions based on location + category
    const searchTerms = query || `${category} deals ${location}`;
    
    // Return potential sources for deals in this location/category
    return {
      sources: [
        {
          type: 'merchant_website',
          suggestion: `Search ${location} ${category} businesses for deals`,
          commonPatterns: ['happy hour', 'special offer', 'discount', 'promotion'],
        },
        {
          type: 'local_calendar',
          suggestion: `Check ${location} event calendars and tourism sites`,
        },
        {
          type: 'social_media',
          suggestion: `Search Facebook/Instagram for ${location} ${category} promotions`,
        },
      ],
      searchQuery: searchTerms,
    };
  },

  extract_deal_from_url: async ({ url, merchantName, category }) => {
    try {
      const { data: html } = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'DWIGO-Deal-Fetcher/1.0 (+https://dwigo.com)',
        },
      });

      const $ = cheerio.load(html);
      
      // Extract basic info
      const title = $('h1').first().text().trim() || 
                   $('title').text().trim() ||
                   merchantName || 'Deal';
      
      const description = $('meta[name="description"]').attr('content') ||
                         $('p').first().text().trim() ||
                         '';

      // Look for price/discount patterns
      const text = $('body').text();
      const priceMatch = text.match(/\$[\d.]+/);
      const discountMatch = text.match(/(\d+)%?\s*(off|discount)/i);

      return {
        title,
        description: description.substring(0, 500),
        category: category || 'General',
        price: priceMatch ? priceMatch[0] : null,
        discount: discountMatch ? discountMatch[1] : null,
        sourceUrl: url,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: `Failed to extract from ${url}: ${error.message}`,
      };
    }
  },

  match_deal_to_user: ({ deal, userPreferences, userLocation, userBehaviors }) => {
    let score = 0.5; // Base score
    const reasons = [];

    // Category match
    if (userPreferences?.preferredCategories?.includes(deal.category)) {
      score += 0.2;
      reasons.push('matches preferred category');
    }

    // Brand/merchant match
    if (userPreferences?.preferredBrands?.some(brand => 
      deal.merchantName?.toLowerCase().includes(brand.toLowerCase())
    )) {
      score += 0.15;
      reasons.push('matches preferred brand');
    }

    // Location match
    if (userLocation && deal.latitude && deal.longitude) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        deal.latitude,
        deal.longitude
      );
      if (distance < 5) {
        score += 0.15;
        reasons.push('very close to user');
      } else if (distance < 15) {
        score += 0.1;
        reasons.push('nearby');
      }
    }

    // Behavior match (similar deals saved/viewed)
    if (userBehaviors?.savedCategories?.includes(deal.category)) {
      score += 0.1;
      reasons.push('user has saved similar deals');
    }

    return {
      matchScore: Math.min(score, 1.0),
      reasons,
      recommended: score >= 0.7,
    };
  },

  score_deal_quality: ({ deal }) => {
    let score = 0;
    const issues = [];
    const strengths = [];

    if (deal.title) {
      score += 0.2;
      strengths.push('has title');
    } else {
      issues.push('missing title');
    }

    if (deal.description) {
      score += 0.15;
      strengths.push('has description');
    }

    if (deal.category) {
      score += 0.1;
      strengths.push('has category');
    }

    if (deal.price || deal.discountPercentage) {
      score += 0.2;
      strengths.push('has pricing info');
    } else {
      issues.push('missing pricing');
    }

    if (deal.latitude && deal.longitude) {
      score += 0.15;
      strengths.push('has location');
    } else {
      issues.push('missing location coordinates');
    }

    if (deal.startDate && deal.endDate) {
      score += 0.1;
      strengths.push('has date range');
    }

    if (deal.sourceUrl) {
      score += 0.1;
      strengths.push('has source URL');
    }

    return {
      qualityScore: Math.min(score, 1.0),
      issues,
      strengths,
      isValid: score >= 0.6 && !issues.includes('missing title'),
    };
  },
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Call OpenAI API with function calling
 */
async function callLLMWithTools(messages, tools = DEAL_FETCHING_TOOLS) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await axios.post(
      `${OPENAI_API_BASE}/chat/completions`,
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Use mini for cost efficiency
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data;
  } catch (error) {
    const errorDetails = error.response?.data || {};
    const errorMessage = errorDetails.error?.message || error.message;
    const errorCode = errorDetails.error?.code || error.response?.status;
    
    console.error('[DealFetchingAgent] OpenAI API error:', {
      message: errorMessage,
      code: errorCode,
      status: error.response?.status,
      type: errorDetails.error?.type,
      fullError: errorDetails,
    });
    
    // Provide helpful error messages for common issues
    if (errorCode === 'insufficient_quota' || errorMessage?.includes('quota')) {
      throw new Error('OpenAI API: Insufficient credits/quota. Please add credits to your OpenAI account or check your billing.');
    } else if (errorCode === 'invalid_api_key' || error.response?.status === 401) {
      throw new Error('OpenAI API: Invalid API key. Please check your OPENAI_API_KEY environment variable.');
    } else if (errorCode === 'rate_limit_exceeded') {
      throw new Error('OpenAI API: Rate limit exceeded. Please wait a moment and try again.');
    }
    
    throw error;
  }
}

/**
 * Execute tool calls from LLM response
 */
async function executeToolCalls(toolCalls) {
  const results = [];

  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    if (toolImplementations[name]) {
      try {
        const result = await toolImplementations[name](parsedArgs);
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name,
          content: JSON.stringify(result),
        });
      } catch (error) {
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name,
          content: JSON.stringify({ error: error.message }),
        });
      }
    } else {
      results.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name,
        content: JSON.stringify({ error: `Unknown tool: ${name}` }),
      });
    }
  }

  return results;
}

/**
 * Discover deals for pilot locations using LLM
 */
async function discoverDealsForPilotLocations(options = {}) {
  const { categories = ['Dining', 'Entertainment', 'Shopping'], maxDealsPerLocation = 10 } = options;

  if (!OPENAI_API_KEY) {
    console.warn('[DealFetchingAgent] OPENAI_API_KEY not set, skipping LLM-based discovery');
    return [];
  }

  console.log(`[DealFetchingAgent] Starting discovery for ${PILOT_LOCATIONS.length} locations, ${categories.length} categories`);

  const allDeals = [];

  // Process locations in parallel (but categories sequentially to avoid rate limits)
  const locationPromises = PILOT_LOCATIONS.map(async (location) => {
    const locationDeals = [];
    
    for (const category of categories) {
      try {
        console.log(`[DealFetchingAgent] Discovering deals for ${location.name} - ${category}...`);
        
        // IMPORTANT: This is a placeholder implementation.
        // In production, this should:
        // 1. Search for REAL businesses in the area (Google Places, Yelp, etc.)
        // 2. Find actual current deals/promotions for those businesses
        // 3. Validate merchants exist before generating deals
        // 
        // For now, we're generating synthetic deals as a proof of concept.
        // These should be manually reviewed and validated before promotion.
        
        const now = new Date();
        const currentDateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const currentYear = now.getFullYear();
        const futureDate = new Date(now);
        futureDate.setDate(futureDate.getDate() + 60); // 60 days from now
        const futureDateStr = futureDate.toISOString().split('T')[0];
        
        // First, find real businesses using Google Places API (if available)
        let verifiedBusinesses = [];
        if (process.env.GOOGLE_PLACES_API_KEY) {
          try {
            const { searchGooglePlaces } = require('../merchantValidation');
            
            // Search for businesses in this category and location
            const cityName = location.name.split(',')[0].trim();
            const stateAbbr = location.name.split(',')[1]?.trim() || 'MI';
            
            // Build search query based on category
            let searchQuery = `${category} in ${cityName}`;
            if (category === 'Dining') {
              searchQuery = `restaurants in ${cityName}`;
            } else if (category === 'Shopping') {
              searchQuery = `shopping stores in ${cityName}`;
            } else if (category === 'Entertainment') {
              searchQuery = `entertainment venues in ${cityName}`;
            }
            
            console.log(`[DealFetchingAgent] Searching Google Places: "${searchQuery}"`);
            const placesResult = await searchGooglePlaces(searchQuery, cityName, stateAbbr, { returnAll: true });
            
            if (placesResult && placesResult.results && placesResult.results.length > 0) {
              // Use the results array from searchGooglePlaces
              verifiedBusinesses = placesResult.results.slice(0, maxDealsPerLocation).map(place => ({
                name: place.name,
                address: place.address || place.formatted_address || '',
                latitude: place.location?.lat || place.geometry?.location?.lat || location.latitude,
                longitude: place.location?.lng || place.geometry?.location?.lng || location.longitude,
                rating: place.rating || null,
                placeId: place.placeId || place.place_id || null,
                types: place.types || [],
              }));
              console.log(`[DealFetchingAgent] ✅ Found ${verifiedBusinesses.length} verified businesses via Google Places for ${location.name} ${category}`);
              console.log(`[DealFetchingAgent] Businesses: ${verifiedBusinesses.map(b => b.name).join(', ')}`);
            } else {
              console.warn(`[DealFetchingAgent] ⚠️  No verified businesses found via Google Places for ${location.name} ${category}`);
            }
          } catch (placesError) {
            console.error(`[DealFetchingAgent] ❌ Google Places search failed: ${placesError.message}`);
            console.error(`[DealFetchingAgent] Error details:`, placesError.stack?.substring(0, 300));
          }
        } else {
          console.warn(`[DealFetchingAgent] ⚠️  GOOGLE_PLACES_API_KEY not configured - cannot verify businesses`);
        }
        
        // Build detailed business list for LLM
        const businessList = verifiedBusinesses.length > 0
          ? verifiedBusinesses.map((b, idx) => 
              `${idx + 1}. ${b.name} - ${b.address || 'Address not available'} (Rating: ${b.rating || 'N/A'})`
            ).join('\n')
          : 'NONE - You must return an empty array []';

        const messages = [
          {
            role: 'system',
            content: `You are a deal discovery agent for DWIGO, a local deals platform.

CRITICAL RULES - FOLLOW EXACTLY:
1. ${verifiedBusinesses.length > 0 
  ? `YOU MUST ONLY USE THESE VERIFIED BUSINESSES (found via Google Places API):\n${businessList}\n\nDO NOT invent, modify, or create any other business names. If you cannot create a deal for one of these businesses, skip it.`
  : `NO VERIFIED BUSINESSES FOUND. You MUST return an empty array: []. Do NOT invent fake business names.`}

2. Today's date is ${currentDateStr} (${currentYear}). ALL dates MUST be in ${currentYear} or later.

3. Business names MUST match EXACTLY from the verified list above. Do not abbreviate, modify, or create variations.

4. Generate realistic, current deals that these businesses might actually offer:
   - For restaurants: Happy hour specials, daily specials, seasonal promotions
   - For shopping: Sales, discounts, clearance events
   - For entertainment: Event promotions, ticket discounts, special offers

5. Use the exact addresses provided for each business. Use the latitude/longitude from the business data.

Return ONLY a valid JSON array. Each deal object must have:
{
  "title": string (e.g., "Happy Hour Special", "20% Off Weekend Sale", "Buy One Get One Free"),
  "description": string (brief, realistic description - 1-2 sentences),
  "category": "${category}",
  "merchantName": string (MUST be EXACTLY one of: ${verifiedBusinesses.map(b => `"${b.name}"`).join(', ') || 'NONE - return []'}),
  "address": string (use the address from the verified business list above),
  "city": "${location.name.split(',')[0]}",
  "state": "MI",
  "latitude": number (use the latitude from the verified business),
  "longitude": number (use the longitude from the verified business),
  "price": number|null (optional, if fixed price deal like "$15 meal"),
  "discountPercentage": number|null (optional, if percentage discount like "20% off"),
  "startDate": string (ISO date, must be ${currentDateStr} or later - ${currentYear} only!),
  "endDate": string (ISO date, 30-90 days after startDate - ${currentYear} only!),
  "sourceUrl": string (use "https://dwigo.com" if unknown)
}

${verifiedBusinesses.length > 0 
  ? `Generate ${Math.min(maxDealsPerLocation, verifiedBusinesses.length)} deals, one per business from the verified list. Use each business exactly once.`
  : `Return empty array: []`}

ALL DATES MUST BE IN ${currentYear}. Return JSON array only, no markdown, no explanation.`,
          },
          {
            role: 'user',
            content: verifiedBusinesses.length > 0
              ? `Generate ${Math.min(maxDealsPerLocation, verifiedBusinesses.length)} realistic, current deals for these verified ${category} businesses in ${location.name}. Today is ${currentDateStr} (${currentYear}). Use ONLY the businesses listed above. Return as JSON array only.`
              : `No verified businesses found for ${location.name} ${category}. Return empty array: [].`,
          },
        ];

        const response = await callLLMWithTools(messages, []); // No tools for now - direct generation
        const assistantMessage = response.choices[0].message;
        const content = assistantMessage.content;

        console.log(`[DealFetchingAgent] LLM response received for ${location.name} ${category}`);

        // Parse JSON from response
        try {
          // Extract JSON array from response (might have markdown code blocks)
          let jsonText = content.trim();
          
          // Remove markdown code blocks if present
          if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          }
          
          // Find JSON array
          const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const deals = JSON.parse(jsonMatch[0]);
            console.log(`[DealFetchingAgent] Parsed ${deals.length} deals from LLM for ${location.name} ${category}`);
            
            deals.forEach(deal => {
              // Ensure required fields
              if (deal.title && deal.merchantName) {
                // Find matching verified business to use its exact data
                const verifiedBusiness = verifiedBusinesses.find(
                  b => b.name.toLowerCase() === deal.merchantName.toLowerCase()
                );
                
                const now = new Date();
                const defaultStartDate = now.toISOString();
                const defaultEndDate = new Date(now);
                defaultEndDate.setDate(defaultEndDate.getDate() + 60); // 60 days from now
                
                // Parse and validate dates - fix if they're in the past or wrong year
                let startDate = deal.startDate ? new Date(deal.startDate) : now;
                let endDate = deal.endDate ? new Date(deal.endDate) : defaultEndDate;
                
                // If start date is in the past or before 2025, use today
                if (startDate < now || startDate.getFullYear() < 2025) {
                  console.warn(`[DealFetchingAgent] Fixing invalid startDate: ${deal.startDate} -> ${defaultStartDate}`);
                  startDate = now;
                }
                
                // If end date is before start date or before 2025, set to 60 days from start
                if (endDate <= startDate || endDate.getFullYear() < 2025) {
                  const fixedEndDate = new Date(startDate);
                  fixedEndDate.setDate(fixedEndDate.getDate() + 60);
                  console.warn(`[DealFetchingAgent] Fixing invalid endDate: ${deal.endDate} -> ${fixedEndDate.toISOString()}`);
                  endDate = fixedEndDate;
                }
                
                // Use verified business data if available, otherwise use deal data
                const finalMerchantName = verifiedBusiness ? verifiedBusiness.name : deal.merchantName;
                const finalAddress = verifiedBusiness?.address || deal.address || '';
                const finalLatitude = verifiedBusiness?.latitude || deal.latitude || location.latitude;
                const finalLongitude = verifiedBusiness?.longitude || deal.longitude || location.longitude;
                
                locationDeals.push({
                  title: deal.title,
                  description: deal.description || `${deal.title} at ${finalMerchantName}`,
                  category: deal.category || category,
                  merchantName: finalMerchantName,
                  address: finalAddress,
                  city: deal.city || location.name.split(',')[0],
                  state: deal.state || 'MI',
                  postalCode: deal.postalCode || null,
                  latitude: finalLatitude,
                  longitude: finalLongitude,
                  price: deal.price || null,
                  discountPercentage: deal.discountPercentage || null,
                  startDate: startDate.toISOString(),
                  endDate: endDate.toISOString(),
                  sourceUrl: deal.sourceUrl || `https://dwigo.com/deals/${location.name.toLowerCase().replace(/\s+/g, '-')}`,
                  confidence: verifiedBusiness ? 0.8 : 0.5, // Higher confidence if verified via Google Places
                  requiresValidation: true, // Flag that this needs merchant validation during ingestion
                  googlePlacesId: verifiedBusiness?.placeId || null, // Store Google Places ID for reference
                });
                
                console.log(`[DealFetchingAgent] ✅ Added deal: "${deal.title}" for ${finalMerchantName}${verifiedBusiness ? ' (verified)' : ' (unverified)'}`);
              } else {
                console.warn(`[DealFetchingAgent] ⚠️  Skipping invalid deal: missing title or merchantName`);
              }
            });
          } else {
            console.warn(`[DealFetchingAgent] No JSON array found in LLM response for ${location.name} ${category}`);
            console.warn(`[DealFetchingAgent] Response preview: ${content.substring(0, 200)}`);
          }
        } catch (parseError) {
          console.error(`[DealFetchingAgent] Failed to parse deals from LLM response for ${location.name} ${category}:`, parseError.message);
          console.error(`[DealFetchingAgent] Response was: ${content.substring(0, 500)}`);
        }

        // Be polite - wait between API calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`[DealFetchingAgent] Error discovering deals for ${location.name} ${category}:`, error.message);
        if (error.response) {
          console.error(`[DealFetchingAgent] OpenAI API error details:`, error.response.data);
        }
      }
    }
    
    return locationDeals;
  });
  
  // Wait for all locations to complete
  const locationResults = await Promise.all(locationPromises);
  
  // Flatten results
  for (const locationDeals of locationResults) {
    allDeals.push(...locationDeals);
  }

  console.log(`[DealFetchingAgent] Total deals discovered: ${allDeals.length}`);
  return allDeals;
}

/**
 * Match and score deals for a specific user
 */
async function matchDealsToUser(userId, deals, userPreferences, userLocation, userBehaviors) {
  if (!OPENAI_API_KEY) {
    // Fallback to rule-based matching if no LLM
    return deals.map(deal => ({
      ...deal,
      matchScore: toolImplementations.match_deal_to_user({
        deal,
        userPreferences,
        userLocation,
        userBehaviors,
      }).matchScore,
    }));
  }

  // Use LLM to score matches
  const messages = [
    {
      role: 'system',
      content: `You are a deal matching agent. Score how well each deal matches the user's preferences, location, and behaviors. Return scores from 0.0 to 1.0.`,
    },
    {
      role: 'user',
      content: `Score these deals for a user with preferences: ${JSON.stringify(userPreferences)}, location: ${JSON.stringify(userLocation)}, behaviors: ${JSON.stringify(userBehaviors)}. Deals: ${JSON.stringify(deals.slice(0, 10))}`,
    },
  ];

  try {
    const response = await callLLMWithTools(messages, [
      {
        type: 'function',
        function: {
          name: 'match_deal_to_user',
          description: 'Score deal matches',
          parameters: DEAL_FETCHING_TOOLS[2].function.parameters,
        },
      },
    ]);

    // Process scored deals
    // (Implementation would parse LLM response and merge with deals)
    return deals;
  } catch (error) {
    console.error('[DealFetchingAgent] Error matching deals:', error);
    return deals;
  }
}

module.exports = {
  discoverDealsForPilotLocations,
  matchDealsToUser,
  toolImplementations,
};

