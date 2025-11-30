/**
 * Deal Extractor Service
 * 
 * Uses LLM to extract structured deal data from HTML snippets.
 * Stricter than generation - only extracts what's actually present.
 */

const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

/**
 * Call OpenAI API for extraction
 */
async function callLLMForExtraction(messages) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

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
    
    console.error('[dealExtractor] OpenAI API error:', {
      message: errorMessage,
      code: errorCode,
      status: error.response?.status,
    });
    
    // Handle rate limiting with helpful error
    if (errorCode === 'rate_limit_exceeded' || error.response?.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please wait a few minutes and try again. The scraper makes many API calls - consider reducing the number of sources or waiting between runs.');
    }
    
    throw error;
  }
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
  "rejectionReason": string | null
}

Extraction rules:
- "valid": false if no explicit offer, discount, or promotional language in HTML
- Extract ONLY what's written in the HTML - nothing else
- Dates must be in 2025 or later (if date is in HTML but wrong year, use current date)
- discountPercentage: number (e.g., 20 for "20% off")
- discountValue: string (e.g., "$5 off", "Buy one get one")
- price: number (e.g., 15.99 for "$15.99")

If no deal found in HTML, return: { "valid": false, "rejectionReason": "No deal found in provided HTML" }`;

/**
 * Extract deal from HTML snippet using LLM
 */
async function extractDealFromHtml(merchantName, city, state, htmlSnippet, sourceUrl) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[dealExtractor] OPENAI_API_KEY not configured');
    return { valid: false, rejectionReason: 'LLM not configured' };
  }

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
${htmlSnippet.substring(0, 3000)} ${htmlSnippet.length > 3000 ? '... (truncated)' : ''}

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

module.exports = {
  extractDealFromHtml,
  processScrapedContent,
};

