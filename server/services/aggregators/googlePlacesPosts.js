/**
 * Google Places Posts Integration
 * 
 * Fetches business posts (offers, events, updates) from Google Places API
 * Priority: offers > events > updates
 */

const axios = require('axios');
const { mapGooglePlacesTypes, getGooglePlacesPostPriority, GOOGLE_PLACES_POST_TYPES } = require('../../config/categoryMapping');

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place';

/**
 * Fetch posts for a specific place (business)
 * Note: Google Places API doesn't directly expose posts via the standard API
 * This would require Google My Business API or scraping
 * For now, we'll use Place Details to get business info and simulate posts
 */
async function fetchPlacePosts(placeId) {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('[googlePlacesPosts] GOOGLE_PLACES_API_KEY not configured');
    return [];
  }

  try {
    // Get place details first
    const detailsResponse = await axios.get(`${GOOGLE_PLACES_API_BASE}/details/json`, {
      params: {
        place_id: placeId,
        fields: 'name,formatted_address,geometry,types,website,opening_hours,rating,user_ratings_total',
        key: GOOGLE_PLACES_API_KEY,
      },
      timeout: 10000,
    });

    if (detailsResponse.data.status !== 'OK' || !detailsResponse.data.result) {
      console.warn(`[googlePlacesPosts] Place details not found for place_id: ${placeId}`);
      return [];
    }

    const place = detailsResponse.data.result;
    
    // Note: Google Places API doesn't expose posts directly
    // This would require:
    // 1. Google My Business API (requires business verification)
    // 2. Web scraping (not recommended, against ToS)
    // 3. Partner API access
    
    // For now, return place info that can be used to generate deals
    return [{
      placeId: placeId,
      placeName: place.name,
      address: place.formatted_address,
      location: place.geometry?.location,
      types: place.types || [],
      website: place.website || null,
      rating: place.rating || null,
      // Posts would be here if available via GMB API
      posts: [],
    }];
  } catch (error) {
    console.error(`[googlePlacesPosts] Error fetching posts for place ${placeId}:`, error.message);
    return [];
  }
}

/**
 * Search for businesses and attempt to get their posts
 * Since Google Places API doesn't expose posts, we'll:
 * 1. Search for businesses in the area
 * 2. Get their details
 * 3. Return businesses that could have posts (for future GMB API integration)
 */
async function searchBusinessesWithPosts(query, city, state, options = {}) {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('[googlePlacesPosts] GOOGLE_PLACES_API_KEY not configured');
    return [];
  }

  const { maxResults = 20, postTypes = [GOOGLE_PLACES_POST_TYPES.OFFER] } = options;

  try {
    // Search for businesses
    const searchResponse = await axios.get(`${GOOGLE_PLACES_API_BASE}/textsearch/json`, {
      params: {
        query: `${query} ${city} ${state}`,
        key: GOOGLE_PLACES_API_KEY,
      },
      timeout: 10000,
    });

    if (searchResponse.data.status !== 'OK' || !searchResponse.data.results.length) {
      console.warn(`[googlePlacesPosts] No businesses found for: ${query} in ${city}, ${state}`);
      return [];
    }

    const businesses = [];
    const results = searchResponse.data.results.slice(0, maxResults);

    // Get details for each business
    for (const result of results) {
      try {
        const placeDetails = await fetchPlacePosts(result.place_id);
        if (placeDetails.length > 0) {
          businesses.push(...placeDetails);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`[googlePlacesPosts] Error fetching details for ${result.place_id}:`, error.message);
      }
    }

    console.log(`[googlePlacesPosts] Found ${businesses.length} businesses with potential posts`);
    return businesses;
  } catch (error) {
    console.error('[googlePlacesPosts] Error searching businesses:', error.message);
    return [];
  }
}

/**
 * Convert Google Places business to deal format
 * Note: This is a placeholder - actual posts would come from GMB API
 */
function convertPlaceToDeal(placeData, postType = GOOGLE_PLACES_POST_TYPES.OFFER) {
  const categories = mapGooglePlacesTypes(placeData.types || []);
  const priority = getGooglePlacesPostPriority(postType);
  
  // Generate a synthetic deal based on place info
  // In production, this would use actual post data from GMB API
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30); // Default 30-day offer

  return {
    title: `Special Offer at ${placeData.placeName}`,
    description: `Check out ${placeData.placeName} for current promotions and special offers.`,
    category: categories[0] || 'Entertainment',
    categories: categories, // Multiple categories if applicable
    merchantName: placeData.placeName,
    address: placeData.address,
    latitude: placeData.location?.lat,
    longitude: placeData.location?.lng,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    sourceUrl: placeData.website || `https://www.google.com/maps/place/?q=place_id:${placeData.placeId}`,
    source: 'google_places_posts',
    postType: postType,
    priority: priority,
    placeId: placeData.placeId,
    rating: placeData.rating,
    requiresValidation: true,
    syntheticDeal: true, // Mark as synthetic until we have real post data
    note: 'This is a placeholder deal. Real posts require Google My Business API access.',
  };
}

module.exports = {
  fetchPlacePosts,
  searchBusinessesWithPosts,
  convertPlaceToDeal,
  GOOGLE_PLACES_POST_TYPES,
};

