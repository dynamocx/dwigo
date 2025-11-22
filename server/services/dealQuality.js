/**
 * Deal Quality Validator
 * 
 * Defines what makes a valid "deal" vs just a listing or placeholder.
 * A deal must provide value to the consumer - either through:
 * - Discount (percentage or price reduction)
 * - Special offer (BOGO, free item, etc.)
 * - Event with clear value proposition
 * - Limited-time promotion
 */

const MIN_DISCOUNT_PERCENTAGE = 5; // Minimum 5% discount to be considered a "deal"
const MIN_PRICE_DIFFERENCE = 1; // Minimum $1 savings to be considered a "deal"

// Quality thresholds (configurable via environment)
const MIN_QUALITY_SCORE_FOR_PROMOTION = Number(process.env.MIN_DEAL_QUALITY_SCORE || 0.4); // 40% minimum
const AUTO_REJECT_QUALITY_SCORE = Number(process.env.AUTO_REJECT_QUALITY_SCORE || 0.25); // Auto-reject below 25%

/**
 * Calculate deal quality score (0-1)
 * Higher score = better deal quality
 */
const calculateDealQuality = (fields, rawPayload = {}, normalizedPayload = {}) => {
  let score = 0;
  const reasons = [];

  // 1. Title quality (required, but check if it's meaningful)
  if (fields.title && fields.title.length > 3 && !fields.title.startsWith('Deal ')) {
    score += 0.15;
  } else {
    reasons.push('Missing or generic title');
  }

  // 2. Description quality (highly valuable)
  if (fields.description && fields.description.length > 20) {
    score += 0.25;
  } else if (fields.description && fields.description.length > 10) {
    score += 0.15;
    reasons.push('Description is too short');
  } else {
    reasons.push('Missing description');
  }

  // 3. Discount percentage (strong indicator of a deal)
  if (fields.discountPercentage != null && fields.discountPercentage >= MIN_DISCOUNT_PERCENTAGE) {
    score += 0.3;
  } else if (fields.discountPercentage != null && fields.discountPercentage > 0) {
    score += 0.15;
    reasons.push(`Discount is below ${MIN_DISCOUNT_PERCENTAGE}%`);
  }

  // 4. Price difference (alternative to percentage discount)
  if (fields.originalPrice != null && fields.dealPrice != null) {
    const savings = fields.originalPrice - fields.dealPrice;
    if (savings >= MIN_PRICE_DIFFERENCE) {
      score += 0.3;
    } else if (savings > 0) {
      score += 0.15;
      reasons.push(`Savings is less than $${MIN_PRICE_DIFFERENCE}`);
    }
  } else if (fields.dealPrice != null) {
    // Has a price but no comparison - could be an event or special offer
    score += 0.1;
    reasons.push('Has price but no comparison price');
  }

  // 5. Special offer indicators (BOGO, free item, etc.)
  const description = (fields.description || '').toLowerCase();
  const title = (fields.title || '').toLowerCase();
  const hasSpecialOffer =
    description.includes('buy') && description.includes('get') ||
    description.includes('bogo') ||
    description.includes('free') ||
    description.includes('special') ||
    title.includes('special') ||
    title.includes('free');
  
  if (hasSpecialOffer) {
    score += 0.2;
  }

  // 6. Category (helps with organization)
  if (fields.category) {
    score += 0.05;
  } else {
    reasons.push('Missing category');
  }

  // 7. Time-limited (indicates urgency/value)
  if (fields.endDate) {
    score += 0.1;
  } else {
    reasons.push('No expiration date');
  }

  // 8. Terms/conditions (shows it's a real offer)
  if (fields.terms) {
    score += 0.05;
  }

  return {
    score: Math.min(score, 1.0), // Cap at 1.0
    reasons,
    isValid: score >= MIN_QUALITY_SCORE_FOR_PROMOTION,
    shouldAutoReject: score < AUTO_REJECT_QUALITY_SCORE,
  };
};

/**
 * Check if a deal meets minimum quality criteria
 */
const isValidDeal = (fields, rawPayload = {}, normalizedPayload = {}) => {
  const quality = calculateDealQuality(fields, rawPayload, normalizedPayload);
  
  // Must have at least:
  // 1. A meaningful title
  // 2. Either a description OR a discount/price difference
  const hasTitle = fields.title && fields.title.length > 3 && !fields.title.startsWith('Deal ');
  const hasDescription = fields.description && fields.description.length > 10;
  const hasDiscount = 
    (fields.discountPercentage != null && fields.discountPercentage >= MIN_DISCOUNT_PERCENTAGE) ||
    (fields.originalPrice != null && fields.dealPrice != null && 
     (fields.originalPrice - fields.dealPrice) >= MIN_PRICE_DIFFERENCE);
  const hasPrice = fields.dealPrice != null;
  
  // For events, price alone might be enough if there's a description
  const isEvent = fields.category && ['events', 'entertainment', 'activities'].includes(fields.category.toLowerCase());
  const isValidEvent = isEvent && hasDescription && hasPrice;
  
  return quality.isValid && hasTitle && (hasDescription || hasDiscount || isValidEvent);
};

/**
 * Get deal quality assessment with recommendations
 */
const assessDealQuality = (fields, rawPayload = {}, normalizedPayload = {}) => {
  const quality = calculateDealQuality(fields, rawPayload, normalizedPayload);
  const valid = isValidDeal(fields, rawPayload, normalizedPayload);
  
  const recommendations = [];
  if (!valid) {
    if (!fields.description || fields.description.length < 20) {
      recommendations.push('Add a detailed description explaining the offer');
    }
    if (!fields.discountPercentage && (!fields.originalPrice || !fields.dealPrice)) {
      recommendations.push('Include discount percentage or price comparison');
    }
    if (fields.discountPercentage != null && fields.discountPercentage < MIN_DISCOUNT_PERCENTAGE) {
      recommendations.push(`Discount should be at least ${MIN_DISCOUNT_PERCENTAGE}% to be considered a deal`);
    }
  }
  
  return {
    ...quality,
    valid,
    recommendations,
  };
};

module.exports = {
  calculateDealQuality,
  isValidDeal,
  assessDealQuality,
  MIN_DISCOUNT_PERCENTAGE,
  MIN_PRICE_DIFFERENCE,
  MIN_QUALITY_SCORE_FOR_PROMOTION,
  AUTO_REJECT_QUALITY_SCORE,
};

