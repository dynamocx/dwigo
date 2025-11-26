/**
 * Eventbrite API Integration
 * 
 * Fetches events from Eventbrite API for Mid-Michigan area
 * API Docs: https://www.eventbrite.com/platform/api/
 * 
 * Requires EVENTBRITE_API_TOKEN environment variable
 */

const axios = require('axios');

const EVENTBRITE_API_BASE = 'https://www.eventbriteapi.com/v3';
const MID_MICHIGAN_LOCATIONS = [
  { name: 'Lansing, MI', latitude: 42.7325, longitude: -84.5555 },
  { name: 'Flint, MI', latitude: 43.0125, longitude: -83.6875 },
  { name: 'Grand Blanc, MI', latitude: 42.9275, longitude: -83.6169 },
  { name: 'Fenton, MI', latitude: 42.7978, longitude: -83.7050 },
];

/**
 * Fetch events from Eventbrite for a given location
 */
const fetchEventsForLocation = async (location, options = {}) => {
  const { latitude, longitude, name } = location;
  const apiToken = process.env.EVENTBRITE_API_TOKEN;

  if (!apiToken) {
    console.warn('[Eventbrite] EVENTBRITE_API_TOKEN not set, skipping Eventbrite integration');
    return [];
  }

  try {
    // Eventbrite search endpoint - search within 25km radius
    const response = await axios.get(`${EVENTBRITE_API_BASE}/events/search/`, {
      params: {
        'location.latitude': latitude,
        'location.longitude': longitude,
        'location.within': '25km',
        'start_date.range_start': options.startDate || new Date().toISOString(),
        'start_date.range_end': options.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        'status': 'live',
        'order_by': 'start_asc',
        'expand': 'venue',
        'page_size': 50,
      },
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      timeout: 15000,
    });

    const events = response.data?.events || [];
    console.log(`[Eventbrite] Found ${events.length} events near ${name}`);

    return events.map(event => transformEventbriteEvent(event, location));
  } catch (error) {
    console.error(`[Eventbrite] Error fetching events for ${name}:`, error.message);
    if (error.response) {
      console.error(`[Eventbrite] API Error:`, error.response.status, error.response.data);
    }
    return [];
  }
};

/**
 * Transform Eventbrite event to DWIGO deal format
 */
const transformEventbriteEvent = (event, location) => {
  const venue = event.venue || {};
  const startDate = event.start?.utc ? new Date(event.start.utc) : null;
  const endDate = event.end?.utc ? new Date(event.end.utc) : null;

  // Extract pricing info
  let price = null;
  let discountPercentage = null;
  if (event.ticket_availability?.is_free) {
    discountPercentage = 100; // Free event = 100% discount
  } else if (event.ticket_availability?.minimum_ticket_price) {
    const ticketPrice = event.ticket_availability.minimum_ticket_price;
    price = ticketPrice.major_value + (ticketPrice.minor_value / 100);
  }

  // Determine category
  let category = 'Entertainment';
  const categoryId = event.category_id;
  if (categoryId) {
    // Map Eventbrite categories to DWIGO categories
    const categoryMap = {
      '103': 'Entertainment', // Music
      '104': 'Entertainment', // Food & Drink
      '105': 'Entertainment', // Sports & Fitness
      '106': 'Entertainment', // Travel & Outdoor
      '107': 'Entertainment', // Business
      '108': 'Entertainment', // Science & Technology
      '109': 'Entertainment', // Health
      '110': 'Entertainment', // Education
      '111': 'Entertainment', // Family
      '112': 'Entertainment', // Holiday
      '113': 'Entertainment', // Community
      '114': 'Entertainment', // Arts
      '115': 'Entertainment', // Film & Media
      '116': 'Entertainment', // Fashion
      '117': 'Entertainment', // Home & Lifestyle
      '118': 'Entertainment', // Auto & Boat
      '119': 'Entertainment', // Hobbies
      '199': 'Entertainment', // Other
    };
    category = categoryMap[categoryId] || 'Entertainment';
  }

  const merchantAlias = venue.name || event.organizer?.name || 'Eventbrite Event';

  return {
    merchantAlias,
    rawPayload: {
      title: event.name?.text || 'Untitled Event',
      description: event.description?.text || event.summary || null,
      category,
      address: venue.address?.localized_address_display || venue.address?.address_1 || null,
      city: venue.address?.city || location.name.split(',')[0] || null,
      state: venue.address?.region || 'MI',
      postalCode: venue.address?.postal_code || null,
      latitude: venue.latitude || location.latitude,
      longitude: venue.longitude || location.longitude,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      price,
      sourceUrl: event.url || null,
      eventbriteId: event.id,
      eventbriteOrganizerId: event.organizer_id,
    },
    normalizedPayload: {
      title: event.name?.text || 'Untitled Event',
      description: event.description?.text || event.summary || null,
      category,
      location: {
        city: venue.address?.city || location.name.split(',')[0] || null,
        state: venue.address?.region || 'MI',
        latitude: venue.latitude || location.latitude,
        longitude: venue.longitude || location.longitude,
      },
      ...(price ? {
        price: {
          currency: 'USD',
          amount: price,
        },
      } : {}),
      ...(discountPercentage ? {
        discount: {
          type: 'percentage',
          value: discountPercentage,
        },
      } : {}),
      schedule: startDate ? {
        type: 'one_time',
        rule: {
          startsAt: startDate.toISOString(),
          endsAt: endDate ? endDate.toISOString() : null,
        },
      } : null,
      sourceUrl: event.url,
    },
    confidence: 0.85, // High confidence for Eventbrite data
  };
};

/**
 * Fetch events for all Mid-Michigan locations
 */
const fetchMidMichiganEvents = async (options = {}) => {
  const allDeals = [];

  for (const location of MID_MICHIGAN_LOCATIONS) {
    const deals = await fetchEventsForLocation(location, options);
    allDeals.push(...deals);
    
    // Be polite - wait between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Deduplicate by eventbriteId
  const uniqueDeals = [];
  const seenIds = new Set();
  
  for (const deal of allDeals) {
    const eventId = deal.rawPayload.eventbriteId;
    if (eventId && !seenIds.has(eventId)) {
      seenIds.add(eventId);
      uniqueDeals.push(deal);
    } else if (!eventId) {
      // Include deals without IDs (shouldn't happen, but be safe)
      uniqueDeals.push(deal);
    }
  }

  console.log(`[Eventbrite] Total unique events found: ${uniqueDeals.length}`);
  return uniqueDeals;
};

module.exports = {
  fetchMidMichiganEvents,
  fetchEventsForLocation,
};

