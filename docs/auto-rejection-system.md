# Auto-Rejection System

## Overview

To scale across all U.S. regions, DWIGO automatically rejects low-quality deals during ingestion. This prevents the database from filling with non-deals and reduces manual review workload.

## How It Works

### Two-Stage Quality Check

1. **During Ingestion** (First Line of Defense)
   - When deals are first ingested, quality is assessed
   - Deals below `AUTO_REJECT_QUALITY_SCORE` (default: 25%) are immediately rejected
   - Status set to `auto_rejected`
   - Rejection reason logged in `ingestion_errors`

2. **During Promotion** (Second Check)
   - Even if a deal passes ingestion, quality is checked again during promotion
   - Prevents low-quality deals from being manually promoted
   - Admin can still override if needed (future enhancement)

## Configuration

### Environment Variables

```env
# Minimum quality score for promotion (0.0 to 1.0)
MIN_DEAL_QUALITY_SCORE=0.4  # 40% - deals below this need manual review

# Auto-reject threshold (0.0 to 1.0)
AUTO_REJECT_QUALITY_SCORE=0.25  # 25% - deals below this are auto-rejected
```

### Adjusting Thresholds

**For Stricter Quality (Fewer Deals):**
```env
MIN_DEAL_QUALITY_SCORE=0.5   # 50% minimum
AUTO_REJECT_QUALITY_SCORE=0.3  # 30% auto-reject
```

**For More Lenient (More Deals):**
```env
MIN_DEAL_QUALITY_SCORE=0.3   # 30% minimum
AUTO_REJECT_QUALITY_SCORE=0.15  # 15% auto-reject
```

## Quality Scoring

Deals are scored 0-1 based on:

| Factor | Points | Description |
|--------|--------|-------------|
| Title Quality | 15% | Meaningful, descriptive title |
| Description Quality | 25% | Detailed explanation (20+ chars) |
| Discount Percentage | 30% | ≥5% discount |
| Price Difference | 30% | ≥$1 savings |
| Special Offers | 20% | BOGO, free items, etc. |
| Category | 5% | Helps with organization |
| Time-Limited | 10% | Has expiration date |
| Terms & Conditions | 5% | Terms provided |

**Total Possible: 140%** (capped at 100%)

## Auto-Rejection Criteria

A deal is **auto-rejected** if:
- Quality score < `AUTO_REJECT_QUALITY_SCORE` (default: 25%)
- Missing critical fields (title, description, value proposition)

## What Happens to Auto-Rejected Deals

1. **Status**: Set to `auto_rejected`
2. **Storage**: Still stored in `ingested_deal_raw` for audit trail
3. **Logging**: Rejection reason logged in `ingestion_errors`
4. **Admin Visibility**: Can be viewed in admin panel (future enhancement)

## Monitoring

### Check Auto-Rejection Stats

```sql
-- Count auto-rejected deals in last 7 days
SELECT COUNT(*) 
FROM ingested_deal_raw 
WHERE status = 'auto_rejected' 
  AND created_at > NOW() - INTERVAL '7 days';

-- View rejection reasons
SELECT 
  r.id,
  r.merchant_alias,
  e.error_message,
  r.created_at
FROM ingested_deal_raw r
JOIN ingestion_errors e ON e.job_id = r.job_id
WHERE r.status = 'auto_rejected'
  AND e.stage = 'quality_check'
ORDER BY r.created_at DESC
LIMIT 50;
```

### Admin Panel

The admin review page shows:
- Quality score for each pending deal
- Warnings for deals below promotion threshold
- Recommendations for improving deals

## Examples

### ✅ Will Pass (Quality ≥ 25%)

**Example 1: Good Discount Deal**
- Title: "Electronics Sale"
- Description: "20% off all electronics"
- Discount: 20%
- **Score: 0.85** ✅ Passes

**Example 2: Price Deal**
- Title: "Coffee Special"
- Description: "Buy 2 get 1 free"
- Original: $5.00, Deal: $3.33
- **Score: 0.80** ✅ Passes

### ❌ Will Be Auto-Rejected (Quality < 25%)

**Example 1: Empty Deal**
- Title: "LBC Beer"
- Description: (empty)
- Discount: (none)
- Price: (none)
- **Score: 0.15** ❌ Auto-rejected

**Example 2: Generic Listing**
- Title: "Menu"
- Description: "Our menu"
- **Score: 0.20** ❌ Auto-rejected

## Benefits

1. **Scale**: Handles millions of deals without manual review
2. **Quality**: Only real "deals" make it to consumers
3. **Efficiency**: Reduces database bloat and processing time
4. **Consistency**: Same quality standards across all regions
5. **Audit Trail**: All rejections logged for analysis

## Future Enhancements

1. **Admin Override**: Allow admins to manually promote auto-rejected deals
2. **Rejection Dashboard**: View and analyze auto-rejected deals
3. **Source-Specific Rules**: Different thresholds per source
4. **Machine Learning**: Learn from admin approvals to improve scoring
5. **Regional Adjustments**: Different thresholds per region if needed

## Troubleshooting

### Too Many Deals Rejected

**Problem**: Legitimate deals are being auto-rejected

**Solution**: 
1. Check rejection reasons in `ingestion_errors`
2. Adjust `AUTO_REJECT_QUALITY_SCORE` higher (e.g., 0.20)
3. Improve crawler data extraction

### Too Many Low-Quality Deals Passing

**Problem**: Poor deals are making it through

**Solution**:
1. Lower `AUTO_REJECT_QUALITY_SCORE` (e.g., 0.30)
2. Improve quality scoring algorithm
3. Add more validation rules

### Need to Review Auto-Rejected Deals

**Solution**: Query `ingested_deal_raw` where `status = 'auto_rejected'` and review manually if needed.

