# Deal Quality Criteria

## What Makes a "Deal"?

A **deal** must provide clear value to the consumer. It's not just a listing or placeholder - it must offer:
- A discount (percentage or price reduction)
- A special offer (BOGO, free item, etc.)
- An event with clear value proposition
- A limited-time promotion

## Minimum Requirements

### Required Fields
1. **Title** - Must be meaningful (not "Deal 123" or generic)
2. **Description** - Must explain the offer (minimum 20 characters recommended)
3. **Value Proposition** - Must have at least ONE of:
   - Discount percentage ≥ 5%
   - Price savings ≥ $1
   - Special offer (BOGO, free item, etc.)
   - Event with clear pricing and description

### Quality Scoring

Deals are scored 0-1 based on:
- **Title quality** (15 points) - Meaningful, descriptive
- **Description quality** (25 points) - Detailed explanation
- **Discount percentage** (30 points) - ≥5% discount
- **Price difference** (30 points) - ≥$1 savings
- **Special offers** (20 points) - BOGO, free items, etc.
- **Category** (5 points) - Helps with organization
- **Time-limited** (10 points) - Has expiration date
- **Terms** (5 points) - Terms & conditions provided

**Minimum score for auto-promotion:** 0.4 (40%)

## Examples

### ✅ Good Deals

**Example 1: Discount Deal**
- Title: "Electronics Sale"
- Description: "20% off all electronics"
- Discount: 20%
- **Score: 0.85** ✅

**Example 2: Price Deal**
- Title: "Coffee Special"
- Description: "Buy 2 get 1 free coffee"
- Original Price: $5.00
- Deal Price: $3.33
- **Score: 0.80** ✅

**Example 3: Event Deal**
- Title: "Winter Wine Walk & Cheese Pairings"
- Description: "Stroll the greenhouse with live acoustic music, sample 6 curated wine and cheese pairings."
- Price: $25
- Category: Events
- **Score: 0.70** ✅

### ❌ Poor Deals

**Example 1: Missing Information**
- Title: "LBC Beer"
- Description: (empty)
- Discount: (none)
- Price: (none)
- **Score: 0.15** ❌

**Example 2: Generic Title**
- Title: "Deal 123"
- Description: "Special offer"
- **Score: 0.20** ❌

**Example 3: No Value Proposition**
- Title: "Menu"
- Description: "Our menu"
- **Score: 0.10** ❌

## Recommendations for Crawlers

When building crawlers, prioritize:
1. **Discount information** - Extract percentage or price comparison
2. **Descriptive titles** - Not just "Sale" or "Special"
3. **Detailed descriptions** - Explain what the offer includes
4. **Expiration dates** - Time-limited offers are more valuable
5. **Terms & conditions** - Helps consumers understand the offer

## Admin Review Guidelines

When reviewing deals in the admin panel:
1. **Check quality warnings** - Deals with low scores will show warnings
2. **Verify value proposition** - Does this actually save money or provide value?
3. **Ensure completeness** - Missing fields reduce deal quality
4. **Reject if needed** - Not everything crawled is a "deal"

## Auto-Promotion Rules

Deals are automatically promoted if:
- Quality score ≥ 0.4 (40%)
- Confidence score ≥ 0.75 (75%)
- All required fields present

Otherwise, they require manual review.

