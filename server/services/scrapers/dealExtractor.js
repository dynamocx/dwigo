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
    console.error('[dealExtractor] OpenAI API error:', error.response?.data || error.message);
    throw error;
  }
}

const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction assistant for a deals platform.
Given a merchant name and HTML snippet from their website, extract deal information.

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

Rules:
- Set "valid": false if no explicit offer, discount, or time-bound promotional language
- Only extract information that is clearly stated in the HTML
- Do NOT invent or infer deals that aren't explicitly mentioned
- Dates must be in 2025 or later
- If discount is mentioned, extract as discountPercentage (number) or discountValue (string like "$5 off")
- If price is mentioned, extract as price (number)

Return { "valid": false, "rejectionReason": "..." } if no deal found.`;

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
      content: `Extract deal information from this HTML snippet for ${merchantName} in ${city}, ${state}.

HTML Snippet:
${htmlSnippet.substring(0, 3000)} ${htmlSnippet.length > 3000 ? '... (truncated)' : ''}

Source URL: ${sourceUrl}

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
  
  if (!scrapeResult.success || !scrapeResult.extractedItems || scrapeResult.extractedItems.length === 0) {
    return deals;
  }

  for (const item of scrapeResult.extractedItems) {
    // Combine title, description, and date for LLM extraction
    const htmlSnippet = `
      <div class="deal-item">
        ${item.title ? `<h3>${item.title}</h3>` : ''}
        ${item.date ? `<time>${item.date}</time>` : ''}
        ${item.description ? `<p>${item.description}</p>` : ''}
        ${item.rawHtml ? item.rawHtml : ''}
      </div>
    `;

    const extracted = await extractDealFromHtml(
      scrapeResult.merchantName,
      scrapeResult.city,
      scrapeResult.state,
      htmlSnippet,
      scrapeResult.url
    );

    if (extracted.valid && extracted.title) {
      deals.push({
        title: extracted.title,
        description: extracted.description || `${extracted.title} at ${scrapeResult.merchantName}`,
        category: scrapeResult.category || 'Shopping',
        merchantName: scrapeResult.merchantName,
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

    // Be polite - small delay between extractions
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return deals;
}

module.exports = {
  extractDealFromHtml,
  processScrapedContent,
};

