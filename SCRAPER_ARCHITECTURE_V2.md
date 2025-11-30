# Scraper Architecture V2 - Production Ready

## Problem with Current Approach

Current scraper uses LLM for **every single item** extracted:
- 6 sources × ~5 items each = 30 LLM calls per scrape
- Hits rate limits quickly
- Slow (2-5 seconds per call)
- Expensive
- Doesn't scale

## Better Architecture: Rule-Based Extraction First

### Phase 1: Structured Extraction (No LLM)

For sites with structured HTML, extract directly using CSS selectors:

```javascript
// Extract deal data directly from HTML structure
const deal = {
  title: $item.find('.deal-title').text(),
  description: $item.find('.deal-description').text(),
  price: extractPrice($item.find('.price').text()),
  discount: extractDiscount($item.find('.discount').text()),
  dates: extractDates($item.find('.dates').text()),
};
```

**No LLM needed** - just parse the HTML structure.

### Phase 2: LLM Only for Unstructured Content

Only use LLM when:
- HTML is completely unstructured
- Need to extract from free-form text
- CSS selectors don't work

### Phase 3: Batch Processing

Instead of processing one-by-one:
- Extract all items first (fast, no LLM)
- Batch validate with merchant validation
- Only use LLM for items that truly need it

## Recommended Implementation

1. **Update baseScraper.js** to extract structured data directly
2. **Add regex/parsing helpers** for common patterns (dates, prices, discounts)
3. **Only call LLM** if structured extraction fails
4. **Batch merchant validation** (Google Places API can handle multiple)

## Benefits

- **10-100x faster** (no LLM for structured content)
- **No rate limits** (minimal LLM usage)
- **Lower cost** (fewer API calls)
- **Scales to thousands of deals**

## Next Steps

1. Build structured extraction parser
2. Add regex helpers for dates/prices/discounts
3. Make LLM optional fallback
4. Test with real merchant sites

