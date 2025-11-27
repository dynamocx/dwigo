# Deal Fetching Agent Architecture

## Current State (Proof of Concept)

The current implementation uses LLM to generate synthetic deals. This has limitations:
- ❌ LLM may invent fake businesses
- ❌ Dates may be incorrect (2023 vs 2025)
- ❌ No verification of merchant existence
- ❌ Low confidence scores (50-70%)

## Recommended Architecture (Production)

### Phase 1: Real Business Discovery

1. **Business Discovery Sources**
   - Google Places API - Search for businesses by category in location
   - Yelp Fusion API - Alternative business directory
   - Local business directories (Chamber of Commerce, etc.)
   - Existing merchant database

2. **Business Validation**
   - Verify business exists via Google Places
   - Check business hours, status (open/closed)
   - Validate address and coordinates
   - Store verified business info

### Phase 2: Deal Discovery

1. **Deal Sources (Priority Order)**
   - **Merchant Direct Feeds** (highest quality)
     - API integrations with merchants
     - CSV uploads from merchants
     - Manual entry by merchants
   
   - **Aggregator APIs** (high quality)
     - Eventbrite (events)
     - Groupon (deals)
     - Yelp (promotions)
     - Google My Business (posts/offers)
   
   - **Web Scraping** (medium quality, requires validation)
     - Merchant websites
     - Social media (Facebook, Instagram)
     - Local deal sites
   
   - **LLM-Assisted Discovery** (low quality, requires validation)
     - Use LLM to extract deals from web pages
     - Use LLM to structure unstructured data
     - Always validate merchants exist

### Phase 3: Validation Pipeline

```
Deal Discovery → Merchant Validation → Deal Quality Check → Confidence Scoring → Admin Review
```

1. **Merchant Validation** (REQUIRED)
   - Check if business exists (Google Places)
   - Verify business name matches
   - Validate address/coordinates
   - Check business is still open

2. **Deal Quality Check**
   - Required fields present (title, merchant, dates)
   - Dates are in the future
   - Discount/price information is valid
   - Source URL is accessible

3. **Confidence Scoring**
   - Direct merchant feed: 95%
   - Aggregator API: 85%
   - Verified web scraping: 75%
   - LLM-generated (validated merchant): 60%
   - LLM-generated (unvalidated): 30% (auto-reject)

### Phase 4: Implementation Plan

#### Immediate (Week 1)
- ✅ Add merchant validation service (DONE)
- ✅ Improve LLM prompts to use real businesses (DONE)
- ✅ Add date validation (DONE)
- ⏳ Enable merchant validation in promotion service
- ⏳ Add Google Places API key configuration

#### Short-term (Weeks 2-4)
- Integrate Google Places API for business discovery
- Add Yelp Fusion API integration
- Build business search/discovery endpoint
- Create deal source prioritization system

#### Medium-term (Months 2-3)
- Integrate Eventbrite API (events)
- Integrate Groupon API (deals)
- Build web scraping pipeline with validation
- Add LLM-assisted extraction from web pages

#### Long-term (Months 4-6)
- Merchant self-service portal
- Direct API integrations with major merchants
- Real-time deal updates
- Automated deal expiration handling

## Configuration

### Environment Variables

```bash
# Merchant Validation
ENABLE_MERCHANT_VALIDATION=true
GOOGLE_PLACES_API_KEY=your_key_here

# Deal Sources
EVENTBRITE_API_KEY=your_key_here
YELP_API_KEY=your_key_here
GROUPON_API_KEY=your_key_here
```

## Current Limitations

1. **No Real Business Discovery**: LLM is asked to "find" businesses but may invent them
2. **No Deal Source Integration**: Not connected to real deal aggregators
3. **Manual Validation Required**: All deals need admin review
4. **Low Confidence Scores**: Synthetic deals start at 50% confidence

## Next Steps

1. **Get Google Places API Key**
   - Sign up at https://console.cloud.google.com/
   - Enable Places API
   - Add key to environment variables

2. **Enable Merchant Validation**
   - Set `ENABLE_MERCHANT_VALIDATION=true`
   - Deals with unverified merchants will be auto-rejected

3. **Integrate Real Deal Sources**
   - Start with Eventbrite (events are easy to validate)
   - Add Yelp promotions
   - Build web scraping for merchant websites

4. **Improve LLM Usage**
   - Use LLM to extract deals from web pages (not generate them)
   - Use LLM to structure unstructured deal data
   - Always validate merchants before using LLM-extracted deals

