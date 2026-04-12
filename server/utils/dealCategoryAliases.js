/**
 * Maps UI preference labels and feed chip labels to canonical deal.category values
 * stored in DB (lowercase, see dealPromotion.extractDealFields).
 * Drink-focused preferences also map to deal.subcategory slugs for tighter personalization.
 */

/** @type {Record<string, { categories: string[], subcategorySlugs?: string[] }>} */
const PREFERENCE_LABEL_RULES = {
  groceries: { categories: ['shopping'] },
  dining: { categories: ['dining'] },
  'home improvement': { categories: ['home'] },
  'family activities': { categories: ['entertainment', 'dining'] },
  wellness: { categories: ['beauty'] },
  travel: { categories: ['travel'] },
  /** Legacy broad bucket — no subcategory filter */
  'spirits, beer & wine': { categories: ['dining', 'shopping', 'entertainment'] },
  'bars & pubs': {
    categories: ['dining'],
    subcategorySlugs: ['bar_pub', 'happy_hour', 'pub', 'sports_bar', 'drink_special'],
  },
  'wineries & breweries': {
    categories: ['dining'],
    subcategorySlugs: ['brewery', 'winery', 'taproom'],
  },
  'night clubs': {
    categories: ['dining', 'entertainment'],
    subcategorySlugs: ['nightclub', 'nightlife'],
  },
  entertainment: { categories: ['entertainment'] },
  shopping: { categories: ['shopping'] },
};

/** Home feed chips (lowercase) → deal.category */
const FEED_CHIP_TO_DEAL_CATEGORY = {
  restaurants: 'dining',
  restaurant: 'dining',
  dining: 'dining',
  'happy hour': 'dining',
  'bars & pubs': 'dining',
  'wineries & breweries': 'dining',
  nightlife: 'dining',
  'night clubs': 'dining',
  shopping: 'shopping',
  entertainment: 'entertainment',
  travel: 'travel',
  home: 'home',
  beauty: 'beauty',
  sports: 'sports',
};

/**
 * Optional subcategory slugs for feed chips (comma-separated in query param).
 * Chip id → list of deals.subcategory values (OR).
 */
const FEED_CHIP_TO_SUBCATEGORIES = {
  'happy hour': ['happy_hour'],
  'bars & pubs': ['bar_pub', 'pub', 'sports_bar', 'drink_special'],
  'wineries & breweries': ['brewery', 'winery', 'taproom'],
  'nightlife': ['nightclub', 'nightlife'],
  'night clubs': ['nightclub', 'nightlife'],
};

/**
 * @param {unknown} prefCats - JSON array from user_preferences.preferred_categories
 * @returns {string[]|null} lowercase deal categories for SQL ANY(), or null if no preference filter
 */
function expandPreferenceCategoriesToDealCategories(prefCats) {
  if (!Array.isArray(prefCats) || prefCats.length === 0) return null;
  const out = new Set();
  for (const p of prefCats) {
    const key = String(p).toLowerCase().trim();
    const rule = PREFERENCE_LABEL_RULES[key];
    if (rule) {
      rule.categories.forEach((c) => out.add(c));
    } else {
      out.add(key);
    }
  }
  return [...out];
}

/**
 * Union of subcategory slugs from drink-specific preference labels only.
 * @param {unknown} prefCats
 * @returns {string[]}
 */
function preferenceSubcategorySlugs(prefCats) {
  if (!Array.isArray(prefCats) || prefCats.length === 0) return [];
  const out = new Set();
  for (const p of prefCats) {
    const key = String(p).toLowerCase().trim();
    const rule = PREFERENCE_LABEL_RULES[key];
    if (rule?.subcategorySlugs?.length) {
      rule.subcategorySlugs.forEach((s) => out.add(s));
    }
  }
  return [...out];
}

/**
 * True if user selected generic Dining or legacy Spirits (broad — do not require subcategory match).
 * @param {unknown} prefCats
 */
function preferenceHasBroadDiningOrSpirits(prefCats) {
  if (!Array.isArray(prefCats) || prefCats.length === 0) return false;
  return prefCats.some((p) => {
    const k = String(p).toLowerCase().trim();
    return k === 'dining' || k === 'spirits, beer & wine';
  });
}

/**
 * @param {string} [chipOrParam] - lowercase from query e.g. "restaurants"
 * @returns {string|null} single deal.category for optional extra filter
 */
function resolveFeedCategoryParam(chipOrParam) {
  if (!chipOrParam || typeof chipOrParam !== 'string') return null;
  const k = chipOrParam.toLowerCase().trim();
  if (!k) return null;
  return FEED_CHIP_TO_DEAL_CATEGORY[k] || k;
}

/**
 * @param {string} [chipOrParam] - lowercase e.g. "happy hour"
 * @returns {string[]|null} subcategory slugs for SQL ANY()
 */
function resolveFeedSubcategorySlugs(chipOrParam) {
  if (!chipOrParam || typeof chipOrParam !== 'string') return null;
  const k = chipOrParam.toLowerCase().trim();
  if (!k) return null;
  const slugs = FEED_CHIP_TO_SUBCATEGORIES[k];
  return slugs?.length ? slugs : null;
}

/**
 * Parse comma-separated subcategory slugs from API query (e.g. happy_hour,bar_pub).
 * @param {string} [raw]
 * @returns {string[]|null}
 */
function parseSubcategoryQueryParam(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9_]+$/.test(s));
  return parts.length ? parts : null;
}

module.exports = {
  expandPreferenceCategoriesToDealCategories,
  preferenceSubcategorySlugs,
  preferenceHasBroadDiningOrSpirits,
  resolveFeedCategoryParam,
  resolveFeedSubcategorySlugs,
  parseSubcategoryQueryParam,
  PREFERENCE_LABEL_RULES,
  FEED_CHIP_TO_DEAL_CATEGORY,
  FEED_CHIP_TO_SUBCATEGORIES,
};
