/**
 * Client-side deal quality assessment
 * Mirrors server-side logic for preview in admin UI
 */

interface DealFields {
  title?: string | null;
  description?: string | null;
  discountPercentage?: number | null;
  originalPrice?: number | null;
  dealPrice?: number | null;
  category?: string | null;
  endDate?: string | null;
  terms?: string | null;
}

const MIN_DISCOUNT_PERCENTAGE = 5;
const MIN_PRICE_DIFFERENCE = 1;

export const assessDealQuality = (
  normalizedPayload: Record<string, unknown> | null,
  rawPayload: Record<string, unknown> | null
) => {
  const np = normalizedPayload || {};
  const rp = rawPayload || {};

  const fields: DealFields = {
    title: (np.title || rp.title || '') as string,
    description: (np.description || rp.description || '') as string,
    discountPercentage:
      (np.discount?.value as number) ||
      (rp.discountPercentage as number) ||
      (rp.discount as number) ||
      null,
    originalPrice:
      (np.price?.original as number) ||
      (rp.originalPrice as number) ||
      null,
    dealPrice:
      (np.price?.amount as number) ||
      (rp.price as number) ||
      (rp.dealPrice as number) ||
      null,
    category: (np.category || rp.category || '') as string,
    endDate: (np.schedule?.rule?.endsAt as string) || (rp.endDate as string) || null,
    terms: (np.terms || rp.terms || '') as string,
  };

  let score = 0;
  const reasons: string[] = [];

  // Title quality
  if (fields.title && fields.title.length > 3 && !fields.title.startsWith('Deal ')) {
    score += 0.15;
  } else {
    reasons.push('Missing or generic title');
  }

  // Description quality
  if (fields.description && fields.description.length > 20) {
    score += 0.25;
  } else if (fields.description && fields.description.length > 10) {
    score += 0.15;
    reasons.push('Description is too short');
  } else {
    reasons.push('Missing description');
  }

  // Discount percentage
  if (fields.discountPercentage != null && fields.discountPercentage >= MIN_DISCOUNT_PERCENTAGE) {
    score += 0.3;
  } else if (fields.discountPercentage != null && fields.discountPercentage > 0) {
    score += 0.15;
    reasons.push(`Discount is below ${MIN_DISCOUNT_PERCENTAGE}%`);
  }

  // Price difference
  if (fields.originalPrice != null && fields.dealPrice != null) {
    const savings = fields.originalPrice - fields.dealPrice;
    if (savings >= MIN_PRICE_DIFFERENCE) {
      score += 0.3;
    } else if (savings > 0) {
      score += 0.15;
      reasons.push(`Savings is less than $${MIN_PRICE_DIFFERENCE}`);
    }
  } else if (fields.dealPrice != null) {
    score += 0.1;
    reasons.push('Has price but no comparison price');
  }

  // Special offer indicators
  const description = (fields.description || '').toLowerCase();
  const title = (fields.title || '').toLowerCase();
  const hasSpecialOffer =
    (description.includes('buy') && description.includes('get')) ||
    description.includes('bogo') ||
    description.includes('free') ||
    description.includes('special') ||
    title.includes('special') ||
    title.includes('free');

  if (hasSpecialOffer) {
    score += 0.2;
  }

  // Category
  if (fields.category) {
    score += 0.05;
  } else {
    reasons.push('Missing category');
  }

  // Time-limited
  if (fields.endDate) {
    score += 0.1;
  } else {
    reasons.push('No expiration date');
  }

  // Terms
  if (fields.terms) {
    score += 0.05;
  }

  const finalScore = Math.min(score, 1.0);
  const isValid = finalScore >= 0.4;

  const recommendations: string[] = [];
  if (!isValid) {
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
    score: finalScore,
    reasons,
    isValid,
    recommendations,
  };
};

