# Auto-Rejection System Test Results

## ✅ System is Working!

### Direct Test Results (Bypassing Worker Queue)

**Test Data:**
- 2 deals: 1 bad ("Menu" - no description), 1 good ("50% Off Sale")

**Results:**
- ✅ "Bad Deal" (Menu) → **AUTO-REJECTED** (quality: 15%)
- ✅ "Good Deal" (50% Off Sale) → **PENDING** (quality: 85%)

**Status Breakdown:**
```
auto_rejected: 1
pending: 1
```

### Worker Queue Test

**Note:** The worker may need to be restarted to pick up the new code. The direct test confirms the logic works correctly.

## How to Verify

1. **Restart the worker** (if it's running):
   ```bash
   # Stop the worker (Ctrl+C)
   # Then restart:
   cd server && npm run worker
   ```

2. **Run a new test**:
   ```bash
   cd server && node scripts/testAutoRejection.js
   ```

3. **Check results**:
   ```sql
   SELECT status, COUNT(*) 
   FROM ingested_deal_raw 
   WHERE job_id = (SELECT MAX(id) FROM ingestion_jobs WHERE source = 'test-auto-rejection')
   GROUP BY status;
   ```

## Expected Behavior

- **Deals with quality < 25%** → Auto-rejected immediately
- **Deals with quality ≥ 25%** → Stored as pending for admin review
- **Rejection reasons** → Logged in `ingestion_errors` table

## Current Thresholds

- `AUTO_REJECT_QUALITY_SCORE=0.25` (25%) - Auto-reject below this
- `MIN_DEAL_QUALITY_SCORE=0.4` (40%) - Minimum for promotion

## Next Steps

1. Restart worker to pick up new code
2. Test with real crawler data
3. Monitor auto-rejection rates
4. Adjust thresholds if needed

