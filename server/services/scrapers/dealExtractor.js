/**
 * Deal Extractor Service
 * 
 * Uses LLM to extract structured deal data from HTML snippets.
 * Stricter than generation - only extracts what's actually present.
 */

const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

function useClaudeForExtraction() {
  return process.env.EXTRACTION_USE_CLAUDE === 'true' && !!process.env.ANTHROPIC_API_KEY?.trim();
}

function extractionLlmConfigured() {
  return !!OPENAI_API_KEY?.trim() || useClaudeForExtraction();
}

/**
 * Call Anthropic Messages API (same messages shape as OpenAI chat, system extracted).
 */
async function callAnthropicForExtraction(messages, retryCount = 0) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const system = systemParts.join('\n\n');
  const other = messages.filter((m) => m.role !== 'system');
  const anthropicMessages = other.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.3,
        system: system || 'You are a data extraction assistant.',
        messages: anthropicMessages,
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const text = response.data?.content?.[0]?.text || '';
    return { choices: [{ message: { content: text } }] };
  } catch (error) {
    const errorDetails = error.response?.data || {};
    const errorCode = errorDetails.error?.type || error.response?.status;
    if ((error.response?.status === 429 || errorCode === 'rate_limit_error') && retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * 2 ** retryCount;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callAnthropicForExtraction(messages, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Call OpenAI API for extraction with retry logic
 */
async function callLLMForExtraction(messages, retryCount = 0) {
  if (useClaudeForExtraction()) {
    return callAnthropicForExtraction(messages, retryCount);
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured (or set EXTRACTION_USE_CLAUDE=true with ANTHROPIC_API_KEY)');
  }

  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000; // 2 seconds

  try {
    const response = await axios.post(
      `${OPENAI_API_BASE}/chat/completions`,
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        temperature: 0.3, // Lower temperature for extraction (more deterministic)
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
    const errorCode = errorDetails.error?.code || error.response?.status;
    const errorMessage = errorDetails.error?.message || error.message;
    
    // Handle rate limiting with retry
    if ((errorCode === 'rate_limit_exceeded' || error.response?.status === 429) && retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff: 2s, 4s, 8s
      console.warn(`[dealExtractor] Rate limit hit, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return callLLMForExtraction(messages, retryCount + 1);
    }
    
    console.error('[dealExtractor] OpenAI API error:', {
      message: errorMessage,
      code: errorCode,
      status: error.response?.status,
      retryCount,
    });
    
    // Handle rate limiting with helpful error (after max retries)
    if (errorCode === 'rate_limit_exceeded' || error.response?.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please wait a few minutes and try again. The scraper makes many API calls - consider reducing the number of sources or waiting between runs.');
    }
    
    throw error;
  }
}

/**
 * Single subcategory slug for deals.subcategory (personalization / feed filters).
 * @param {object} extracted - LLM output
 * @returns {string|null}
 */
function inferSubcategoryFromExtraction(extracted) {
  const tags = Array.isArray(extracted.tags)
    ? extracted.tags.map((t) => String(t).toLowerCase().replace(/\s+/g, '_'))
    : [];
  const text = `${extracted.title || ''} ${extracted.description || ''}`.toLowerCase();

  const has = (s) => tags.includes(s);
  if (has('happy_hour') || /\bhappy\s*hour\b/.test(text)) return 'happy_hour';
  if (has('nightclub') || has('night_club') || /\bnight\s*club\b/.test(text)) return 'nightclub';
  if (has('nightlife') || /\bnightlife\b/.test(text)) return 'nightlife';
  if (has('taproom') && !has('brewery') && !/\bbrewery\b/.test(text)) return 'taproom';
  if (has('brewery') || /\bbrewery\b|\bmicrobrew\b/.test(text)) return 'brewery';
  if (has('winery') || has('wine_tasting') || /\bwinery\b|\bwine\s*tasting\b/.test(text)) return 'winery';
  if (has('pub') || /\bpub\b|\btavern\b/.test(text)) return 'pub';
  if (has('bar_pub') || has('sports_bar') || /\bcocktail\b|\bbar\s+&\s+grill\b/.test(text)) return 'bar_pub';
  if (has('drink_special') || /\bdrink\s*special\b|\b(?:pint|draft|wine)\s+\$?\d/.test(text)) return 'drink_special';
  return null;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction assistant. Your ONLY job is to extract deal information from the provided HTML.

CRITICAL RULES:
1. The merchant name is ALREADY PROVIDED - use it exactly as given. DO NOT change it or invent a different name.
2. ONLY extract information that is EXPLICITLY written in the HTML snippet below.
3. DO NOT invent, infer, or generate any information not present in the HTML.
4. If the HTML doesn't contain a clear deal/offer/promotion, return { "valid": false }.
5. The merchant name in your response MUST match the merchant name provided to you.

Return ONLY valid JSON with this structure:
{
  "valid": boolean,
  "title": string | null,
  "description": string | null,
  "discountValue": string | null,
  "discountPercentage": number | null,
  "price": number | null,
  "startDate": ISO date string | null,
  "endDate": ISO date string | null,
  "rejectionReason": string | null,
  "tags": string[] | null
}

Extraction rules:
- "valid": false if no explicit offer, discount, or promotional language in HTML
- Extract ONLY what's written in the HTML - nothing else
- Dates must be in 2025 or later (if date is in HTML but wrong year, use current date)
- discountPercentage: number (e.g., 20 for "20% off")
- discountValue: string (e.g., "$5 off", "Buy one get one")
- price: number (e.g., 15.99 for "$15.99")
- tags: optional array of lowercase slugs when the offer is clearly drink/venue-scoped, e.g. "happy_hour", "brewery", "winery", "bar_pub", "nightclub", "drink_special", "pub"

If no deal found in HTML, return: { "valid": false, "rejectionReason": "No deal found in provided HTML" }`;

/**
 * Extract deal from HTML snippet using LLM
 */
async function extractDealFromHtml(merchantName, city, state, htmlSnippet, sourceUrl, options = {}) {
  if (!extractionLlmConfigured()) {
    console.warn('[dealExtractor] No LLM configured (OPENAI_API_KEY or Claude via EXTRACTION_USE_CLAUDE)');
    return { valid: false, rejectionReason: 'LLM not configured' };
  }

  const maxChars = Math.min(Number(options.maxSnippetChars) || Number(process.env.EXTRACTION_HTML_MAX_CHARS) || 12000, 28000);
  const clipped = htmlSnippet.length > maxChars ? `${htmlSnippet.substring(0, maxChars)}... (truncated)` : htmlSnippet;

  const messages = [
    {
      role: 'system',
      content: EXTRACTION_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `MERCHANT NAME: ${merchantName}
LOCATION: ${city}, ${state}
SOURCE URL: ${sourceUrl}

Extract deal information from this HTML snippet. The merchant is "${merchantName}" - use this exact name.

HTML Snippet:
${clipped}

IMPORTANT: 
- The merchant name is "${merchantName}" - do not change it
- Only extract information that is explicitly written in the HTML above
- If no deal is mentioned in the HTML, return { "valid": false }

Return JSON only.`,
    },
  ];

  try {
    // Call LLM for extraction
    const response = await callLLMForExtraction(messages);
    const content = response.choices[0].message.content;

    // Parse JSON from response
    let jsonText = content.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    // Find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      
      // Validate dates are in 2025+
      const now = new Date();
      if (extracted.startDate) {
        const startDate = new Date(extracted.startDate);
        if (startDate.getFullYear() < 2025 || startDate < now) {
          extracted.startDate = now.toISOString();
        }
      }
      
      if (extracted.endDate) {
        const endDate = new Date(extracted.endDate);
        const startDate = extracted.startDate ? new Date(extracted.startDate) : now;
        if (endDate <= startDate || endDate.getFullYear() < 2025) {
          const fixedEnd = new Date(startDate);
          fixedEnd.setDate(fixedEnd.getDate() + 60);
          extracted.endDate = fixedEnd.toISOString();
        }
      }

      extracted._inferredSubcategory = inferSubcategoryFromExtraction(extracted);
      
      return extracted;
    }
    
    return { valid: false, rejectionReason: 'Failed to parse LLM response' };
  } catch (error) {
    console.error('[dealExtractor] Extraction error:', error.message);
    return { valid: false, rejectionReason: `Extraction failed: ${error.message}` };
  }
}

/**
 * Process scraped content and extract deals
 */
async function processScrapedContent(scrapeResult) {
  const deals = [];
  
  if (!scrapeResult.success) {
    console.warn(`[dealExtractor] Scrape failed for ${scrapeResult.merchantName || 'unknown'}`);
    return deals;
  }
  
  if (!scrapeResult.extractedItems || scrapeResult.extractedItems.length === 0) {
    console.warn(`[dealExtractor] No items found for ${scrapeResult.merchantName} - skipping extraction to prevent fake deals`);
    return deals; // CRITICAL: Don't call LLM if no items found - prevents invention
  }
  
  console.log(`[dealExtractor] Processing ${scrapeResult.extractedItems.length} items from ${scrapeResult.merchantName}`);
  
  for (const item of scrapeResult.extractedItems) {
    // If we have structured data, use it directly (no LLM needed)
    if (item.isStructured && item.title && (item.price || item.discountPercentage || item.discountValue)) {
      console.log(`[dealExtractor] Using structured data for ${item.title} (no LLM needed)`);
      
      const now = new Date();
      const startDate = item.startDate || now.toISOString();
      let endDate = item.endDate;
      
      // Validate end date
      if (!endDate || new Date(endDate) <= new Date(startDate) || new Date(endDate).getFullYear() < 2025) {
        const fixedEnd = new Date(startDate);
        fixedEnd.setDate(fixedEnd.getDate() + 60);
        endDate = fixedEnd.toISOString();
      }
      
      const subFromStruct = inferSubcategoryFromExtraction({
        tags: [],
        title: item.title,
        description: item.description,
      });
      deals.push({
        title: item.title,
        description: item.description || `${item.title} at ${scrapeResult.merchantName}`,
        category: scrapeResult.category || 'Shopping',
        subcategory: subFromStruct,
        merchantName: scrapeResult.merchantName,
        city: scrapeResult.city,
        state: scrapeResult.state,
        discountPercentage: item.discountPercentage || null,
        discountValue: item.discountValue || null,
        price: item.price || null,
        startDate,
        endDate,
        sourceUrl: scrapeResult.url,
        confidence: 0.85, // Higher confidence for structured data
        requiresValidation: true,
        extractionMethod: 'structured-scraper', // No LLM used
      });
      
      continue; // Skip LLM extraction for structured items
    }
    
    // Only use LLM for unstructured content
    console.log(`[dealExtractor] Using LLM extraction for unstructured item: ${item.title}`);
    // Use raw HTML if available (more context), otherwise use extracted text
    const htmlSnippet = item.rawHtml && item.rawHtml.length > 50
      ? item.rawHtml
      : `
      <div class="deal-item">
        ${item.title ? `<h3>${item.title}</h3>` : ''}
        ${item.date ? `<time>${item.date}</time>` : ''}
        ${item.description ? `<p>${item.description}</p>` : ''}
      </div>
    `;
    
    // Log what we're sending to LLM for debugging
    console.log(`[dealExtractor] Extracting from ${scrapeResult.merchantName}, HTML length: ${htmlSnippet.length}`);

    const extracted = await extractDealFromHtml(
      scrapeResult.merchantName,
      scrapeResult.city,
      scrapeResult.state,
      htmlSnippet,
      scrapeResult.url
    );

    if (extracted.valid && extracted.title) {
      // Validate merchant name matches (prevent LLM from inventing merchants)
      const extractedMerchantName = extracted.merchantName || scrapeResult.merchantName;
      if (extractedMerchantName.toLowerCase() !== scrapeResult.merchantName.toLowerCase()) {
        console.warn(`[dealExtractor] Merchant name mismatch: LLM returned "${extractedMerchantName}" but source is "${scrapeResult.merchantName}" - using source name`);
      }
      
      deals.push({
        title: extracted.title,
        description: extracted.description || `${extracted.title} at ${scrapeResult.merchantName}`,
        category: scrapeResult.category || 'Shopping',
        subcategory: extracted._inferredSubcategory || null,
        merchantName: scrapeResult.merchantName, // Always use source merchant name, never LLM's version
        city: scrapeResult.city,
        state: scrapeResult.state,
        discountPercentage: extracted.discountPercentage || null,
        discountValue: extracted.discountValue || null,
        price: extracted.price || null,
        startDate: extracted.startDate || new Date().toISOString(),
        endDate: extracted.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        sourceUrl: scrapeResult.url,
        confidence: 0.75, // Scraped deals start at 75% (higher than generated)
        requiresValidation: true,
        extractionMethod: 'scraper+llm',
      });
    } else {
      console.log(`[dealExtractor] Rejected item from ${scrapeResult.merchantName}: ${extracted.rejectionReason || 'No deal found'}`);
    }

    // Be polite - longer delay between extractions to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds between extractions
  }

  return deals;
}

/**
 * When selector-based chunks are empty, one LLM pass on a truncated page (discovery flow).
 */
async function tryExtractSingleDealFromPage(merchantName, city, state, html, sourceUrl, options = {}) {
  const maxChars = options.maxChars ?? 14000;
  if (!html || !extractionLlmConfigured()) return null;
  const compact = html.replace(/\s+/g, ' ').trim();
  const snippet = compact.slice(0, maxChars);
  const category = options.category || 'Dining';
  const extractionMethod = options.extractionMethod || 'places-discovery+fullpage-llm';
  const extracted = await extractDealFromHtml(merchantName, city, state, snippet, sourceUrl, {
    maxSnippetChars: Math.min(maxChars, 12000),
  });
  if (!extracted.valid || !extracted.title) return null;

  const now = new Date();
  const startDate = extracted.startDate || now.toISOString();
  let endDate = extracted.endDate;
  if (!endDate || new Date(endDate) <= new Date(startDate)) {
    const fixed = new Date(startDate);
    fixed.setDate(fixed.getDate() + 60);
    endDate = fixed.toISOString();
  }

  return {
    title: extracted.title,
    description: extracted.description || `${extracted.title} at ${merchantName}`,
    category,
    subcategory: extracted._inferredSubcategory || null,
    merchantName,
    city,
    state,
    discountPercentage: extracted.discountPercentage || null,
    discountValue: extracted.discountValue || null,
    price: extracted.price || null,
    startDate,
    endDate,
    sourceUrl,
    confidence: options.confidence ?? 0.72,
    requiresValidation: true,
    extractionMethod,
  };
}

module.exports = {
  extractDealFromHtml,
  processScrapedContent,
  tryExtractSingleDealFromPage,
  inferSubcategoryFromExtraction,
};

