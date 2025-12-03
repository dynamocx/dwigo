/**
 * Category Mapping Configuration
 * 
 * Maps external source categories to DWIGO internal categories
 * Used for ingestion and preference verification
 */

// DWIGO internal categories
const DWIGO_CATEGORIES = [
  'Dining',
  'Entertainment',
  'Shopping',
  'Spirits, Beer & Wine', // New category for breweries, wineries, bars, pubs
  'Wellness',
  'Travel',
  'Home Improvement',
  'Family Activities',
  'Groceries',
];

// Google Places post types
const GOOGLE_PLACES_POST_TYPES = {
  OFFER: 'offer',      // Priority: Structured deals
  EVENT: 'event',      // May contain promotions
  UPDATE: 'update',    // May contain promotions
};

// Eventbrite category mappings
const EVENTBRITE_TO_DWIGO = {
  // Food & Drink
  'Food & Drink': ['Dining', 'Spirits, Beer & Wine'],
  'Beer': ['Spirits, Beer & Wine'],
  'Wine': ['Spirits, Beer & Wine'],
  'Cocktails': ['Spirits, Beer & Wine'],
  'Breweries': ['Spirits, Beer & Wine'],
  'Wineries': ['Spirits, Beer & Wine'],
  'Bars': ['Spirits, Beer & Wine', 'Dining'],
  'Pubs': ['Spirits, Beer & Wine', 'Dining'],
  'Restaurants': ['Dining'],
  'Food Tours': ['Dining', 'Entertainment'],
  
  // Nightlife -> Entertainment
  'Nightlife': ['Entertainment', 'Spirits, Beer & Wine'],
  'Music': ['Entertainment'],
  'Comedy': ['Entertainment'],
  'Dance': ['Entertainment'],
  
  // Hobbies -> Entertainment
  'Hobbies': ['Entertainment'],
  'Arts': ['Entertainment'],
  'Crafts': ['Entertainment'],
  'Sports & Fitness': ['Entertainment', 'Wellness'],
  
  // Other mappings
  'Business': ['Entertainment'],
  'Science & Tech': ['Entertainment'],
  'Health': ['Wellness'],
  'Travel & Outdoor': ['Travel', 'Entertainment'],
};

// Google Places business type to DWIGO category mappings
const GOOGLE_PLACES_TO_DWIGO = {
  // Restaurant types
  'restaurant': ['Dining'],
  'cafe': ['Dining'],
  'bakery': ['Dining', 'Shopping'],
  'bar': ['Spirits, Beer & Wine', 'Dining'],
  'night_club': ['Entertainment', 'Spirits, Beer & Wine'],
  
  // Breweries/Wineries
  'liquor_store': ['Spirits, Beer & Wine', 'Shopping'],
  'store': ['Shopping'],
  'shopping_mall': ['Shopping'],
  
  // Entertainment
  'movie_theater': ['Entertainment'],
  'amusement_park': ['Entertainment'],
  'zoo': ['Entertainment', 'Family Activities'],
  'museum': ['Entertainment'],
  'art_gallery': ['Entertainment'],
  'bowling_alley': ['Entertainment'],
  'gym': ['Wellness', 'Entertainment'],
  'spa': ['Wellness'],
  
  // Shopping
  'clothing_store': ['Shopping'],
  'electronics_store': ['Shopping'],
  'home_goods_store': ['Shopping', 'Home Improvement'],
  'hardware_store': ['Home Improvement', 'Shopping'],
  
  // Groceries
  'supermarket': ['Groceries'],
  'grocery_or_supermarket': ['Groceries'],
};

/**
 * Map Eventbrite category to DWIGO categories
 */
function mapEventbriteCategory(eventbriteCategory) {
  if (!eventbriteCategory) return ['Entertainment']; // Default
  
  const category = eventbriteCategory.trim();
  
  // Direct match
  if (EVENTBRITE_TO_DWIGO[category]) {
    return EVENTBRITE_TO_DWIGO[category];
  }
  
  // Partial match (case-insensitive)
  const lowerCategory = category.toLowerCase();
  for (const [key, value] of Object.entries(EVENTBRITE_TO_DWIGO)) {
    if (key.toLowerCase().includes(lowerCategory) || lowerCategory.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Default fallback
  return ['Entertainment'];
}

/**
 * Map Google Places business types to DWIGO categories
 */
function mapGooglePlacesTypes(placeTypes = []) {
  const categories = new Set();
  
  for (const type of placeTypes) {
    if (GOOGLE_PLACES_TO_DWIGO[type]) {
      GOOGLE_PLACES_TO_DWIGO[type].forEach(cat => categories.add(cat));
    }
  }
  
  // If no matches, default to Entertainment
  if (categories.size === 0) {
    categories.add('Entertainment');
  }
  
  return Array.from(categories);
}

/**
 * Map Google Places post type to priority
 */
function getGooglePlacesPostPriority(postType) {
  const priorities = {
    [GOOGLE_PLACES_POST_TYPES.OFFER]: 1,    // Highest priority
    [GOOGLE_PLACES_POST_TYPES.EVENT]: 2,    // Medium priority
    [GOOGLE_PLACES_POST_TYPES.UPDATE]: 3,   // Lower priority
  };
  
  return priorities[postType] || 99;
}

/**
 * Validate category against DWIGO categories
 */
function isValidDWIGOCategory(category) {
  return DWIGO_CATEGORIES.includes(category);
}

/**
 * Get all DWIGO categories
 */
function getDWIGOCategories() {
  return [...DWIGO_CATEGORIES];
}

module.exports = {
  DWIGO_CATEGORIES,
  GOOGLE_PLACES_POST_TYPES,
  EVENTBRITE_TO_DWIGO,
  GOOGLE_PLACES_TO_DWIGO,
  mapEventbriteCategory,
  mapGooglePlacesTypes,
  getGooglePlacesPostPriority,
  isValidDWIGOCategory,
  getDWIGOCategories,
};

