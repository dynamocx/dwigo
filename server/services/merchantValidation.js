/**
 * Merchant Validation Service
 * 
 * Validates that merchants/businesses actually exist before promoting deals.
 * Uses multiple sources to verify:
 * - Google Places API (if available)
 * - Web search verification
 * - Address validation
 */

const axios = require('axios');

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place';

/**
 * Search for businesses using Google Places API
 * Can search by specific business name OR by category/location
 * 
 * @param {string} query - Business name OR category search (e.g., "restaurants in Lansing")
 * @param {string} city - City name
 * @param {string} state - State abbreviation
 * @param {Object} options - { exactMatch: boolean, returnAll: boolean }
 * @returns {Object} Validation result or search results
 */
async function searchGooglePlaces(query, city, state, options = {}) {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('[merchantValidation] GOOGLE_PLACES_API_KEY not configured, skipping Google Places validation');
    return null;
  }

  const { exactMatch = false, returnAll = false } = options;

  try {
    // Build search query
    const searchQuery = query.includes(' in ') || query.includes(city) 
      ? query  // Already includes location
      : `${query} ${city} ${state}`;
    
    const response = await axios.get(`${GOOGLE_PLACES_API_BASE}/textsearch/json`, {
      params: {
        query: searchQuery,
        key: GOOGLE_PLACES_API_KEY,
      },
      timeout: 10000, // Increased timeout for category searches
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      // If returnAll is true, return all results (for category searches)
      if (returnAll) {
        return {
          exists: true,
          verified: true,
          source: 'google_places',
          results: response.data.results.map(place => ({
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry?.location,
            rating: place.rating,
            types: place.types,
            formatted_address: place.formatted_address,
            geometry: place.geometry,
          })),
          confidence: 0.9,
        };
      }

      // Otherwise, check for exact/similar match (for validation)
      const place = response.data.results[0];
      
      if (!exactMatch) {
        // Check if the business name is similar (fuzzy match)
        const placeName = place.name.toLowerCase();
        const searchName = query.toLowerCase();
        
        // Simple similarity check - in production, use a proper string similarity algorithm
        const nameMatch = placeName.includes(searchName) || searchName.includes(placeName) || 
                         placeName.split(' ').some(word => searchName.includes(word));
        
        if (nameMatch) {
          return {
            exists: true,
            verified: true,
            source: 'google_places',
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry?.location,
            rating: place.rating,
            types: place.types,
            confidence: 0.9,
          };
        }
      } else {
        // Exact match required
        if (place.name.toLowerCase() === query.toLowerCase()) {
          return {
            exists: true,
            verified: true,
            source: 'google_places',
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry?.location,
            rating: place.rating,
            types: place.types,
            confidence: 0.95,
          };
        }
      }
    }

    return {
      exists: false,
      verified: true,
      source: 'google_places',
      confidence: 0.8, // High confidence that it doesn't exist if not found
    };
  } catch (error) {
    console.error('[merchantValidation] Google Places API error:', error.message);
    if (error.response) {
      console.error('[merchantValidation] API response:', error.response.data);
    }
    return null;
  }
}

/**
 * Validate merchant using web search (fallback if Google Places not available)
 */
async function validateViaWebSearch(businessName, city, state) {
  // This would use a web search API or scraping
  // For now, return uncertain result
  return {
    exists: null, // Unknown
    verified: false,
    source: 'web_search',
    confidence: 0.5,
    note: 'Web search validation not yet implemented',
  };
}

/**
 * Validate a merchant exists
 * @param {Object} merchantInfo - { name, city, state, address?, latitude?, longitude? }
 * @returns {Object} Validation result with exists, verified, confidence, etc.
 */
async function validateMerchant(merchantInfo) {
  const { name, city, state, address, latitude, longitude } = merchantInfo;

  if (!name || !city || !state) {
    return {
      exists: false,
      verified: true,
      confidence: 1.0,
      reason: 'Missing required fields (name, city, state)',
    };
  }

  // Try Google Places first
  const googleResult = await searchGooglePlaces(name, city, state);
  if (googleResult && googleResult.verified) {
    return googleResult;
  }

  // Fallback to web search if Google Places unavailable
  const webResult = await validateViaWebSearch(name, city, state);
  return webResult;
}

/**
 * Check if a merchant should be auto-rejected based on validation
 */
function shouldRejectMerchant(validationResult) {
  // Reject if we're confident it doesn't exist
  if (validationResult.verified && validationResult.exists === false) {
    return {
      shouldReject: true,
      reason: `Merchant "${validationResult.name || 'unknown'}" not found in ${validationResult.source || 'validation service'}`,
      confidence: validationResult.confidence || 0.8,
    };
  }

  // Don't reject if uncertain or verified as existing
  return {
    shouldReject: false,
    reason: validationResult.exists === true ? 'Merchant verified' : 'Validation uncertain',
  };
}

module.exports = {
  validateMerchant,
  shouldRejectMerchant,
  searchGooglePlaces,
};

