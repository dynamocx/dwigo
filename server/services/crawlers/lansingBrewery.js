const axios = require('axios');
const cheerio = require('cheerio');

const SOURCE_URL = 'https://www.lansingbrewingcompany.com/events';
const DEFAULT_CITY = 'Lansing';
const DEFAULT_STATE = 'MI';

const parseDate = (rawText) => {
  if (!rawText) return null;
  const parsed = new Date(rawText.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const sanitize = (value) => (typeof value === 'string' ? value.trim() : '');

const buildDeal = ({ title, description, startsAt, sourceUrl }) => {
  const normalizedTitle = title || 'Lansing Brewing Special Event';

  return {
    merchantAlias: 'Lansing Brewing Company',
    rawPayload: {
      title: normalizedTitle,
      description,
      startDate: startsAt,
      city: DEFAULT_CITY,
      state: DEFAULT_STATE,
      sourceUrl,
    },
    normalizedPayload: {
      title: normalizedTitle,
      description,
      category: 'Events',
      location: {
        name: 'Lansing Brewing Company',
        city: DEFAULT_CITY,
        state: DEFAULT_STATE,
      },
      schedule: startsAt
        ? {
            type: 'one_time',
            rule: {
              startsAt,
            },
          }
        : undefined,
      sourceUrl,
    },
    confidence: startsAt ? 0.8 : 0.6,
  };
};

const extractEvents = ($) => {
  const deals = [];

  const eventCards = $('.event-card, .event, .tribe-events-calendar-list__event');
  if (eventCards.length > 0) {
    eventCards.each((_, element) => {
      const $card = $(element);
      const title =
        sanitize($card.find('.title, .event-title, .tribe-events-calendar-list__event-title').text()) ||
        sanitize($card.find('h3, h2').first().text());
      const description =
        sanitize($card.find('.description, .event-description, .tribe-events-calendar-list__event-description').text()) ||
        sanitize($card.find('p').first().text());
      const dateText =
        sanitize($card.find('.date, time, .tribe-events-calendar-list__event-datetime').text()) ||
        sanitize($card.find('time').attr('datetime'));

      deals.push(
        buildDeal({
          title,
          description,
          startsAt: parseDate(dateText),
          sourceUrl: SOURCE_URL,
        })
      );
    });

    return deals;
  }

  // Fallback: look for list items with anchors
  $('main li a').each((_, element) => {
    const title = sanitize($(element).text());
    if (!title) return;

    deals.push(
      buildDeal({
        title,
        description: null,
        startsAt: null,
        sourceUrl: SOURCE_URL,
      })
    );
  });

  return deals;
};

const crawlLansingBrewery = async () => {
  try {
    const { data: html } = await axios.get(SOURCE_URL, {
      timeout: 15_000,
      headers: {
        'User-Agent': 'DWIGO-Ingestion-Bot/1.0 (+https://dwigo.com)',
      },
    });

    const $ = cheerio.load(html);
    const deals = extractEvents($);

    if (deals.length === 0) {
      console.warn('[crawlLansingBrewery] No events found at Lansing Brewing Company page');
    }

    return deals;
  } catch (error) {
    console.error('[crawlLansingBrewery] Failed to fetch events', error.message);
    return [];
  }
};

module.exports = {
  crawlLansingBrewery,
};


