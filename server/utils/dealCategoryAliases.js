/**
 * Maps UI preference labels and feed chip labels to canonical deal.category values
 * stored in DB (lowercase, see dealPromotion.extractDealFields).
 */

const PREFERENCE_LABEL_TO_DEAL_CATEGORIES = {
  dining: ['dining'],
  groceries: ['shopping'],
  'home improvement': ['home'],
  'family activities': ['entertainment', 'dining'],
  wellness: ['beauty'],
  travel: ['travel'],
  'spirits, beer & wine': ['dining', 'shopping', 'entertainment'],
  entertainment: ['entertainment'],
  shopping: ['shopping'],
};

/** Home feed chips (lowercase) → deal.category */
const FEED_CHIP_TO_DEAL_CATEGORY = {
  restaurants: 'dining',
  restaurant: 'dining',
  dining: 'dining',
  shopping: 'shopping',
  entertainment: 'entertainment',
  travel: 'travel',
  home: 'home',
  beauty: 'beauty',
  sports: 'sports',
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
    const mapped = PREFERENCE_LABEL_TO_DEAL_CATEGORIES[key];
    if (mapped) mapped.forEach((c) => out.add(c));
    else out.add(key);
  }
  return [...out];
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

module.exports = {
  expandPreferenceCategoriesToDealCategories,
  resolveFeedCategoryParam,
  PREFERENCE_LABEL_TO_DEAL_CATEGORIES,
  FEED_CHIP_TO_DEAL_CATEGORY,
};
