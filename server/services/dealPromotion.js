const pool = require('../config/database');
const { findOrCreateMerchant, ensureMerchantAlias, findOrCreateLocation } = require('./merchantMatching');
const { isValidDeal, assessDealQuality } = require('./dealQuality');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseJsonColumn = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

const deriveAlias = (row, rawPayload, normalizedPayload) => {
  return (
    row.merchant_alias ||
    rawPayload.merchantAlias ||
    rawPayload.businessName ||
    rawPayload.merchantName ||
    normalizedPayload.merchantName ||
    normalizedPayload.location?.name ||
    null
  );
};

const extractDealFields = (row, rawPayload = {}, normalizedPayload = {}, jobInfo = {}) => {
  const title =
    normalizedPayload.title ||
    rawPayload.title ||
    `Deal ${row.id}`;
  const description = normalizedPayload.description || rawPayload.description || null;
  // Normalize category to lowercase for consistency
  const categoryRaw = normalizedPayload.category || rawPayload.category || null;
  const category = categoryRaw ? String(categoryRaw).toLowerCase() : null;
  const subcategory = normalizedPayload.subcategory || rawPayload.subcategory || null;

  const price = normalizedPayload.price || {};
  const discount = normalizedPayload.discount || {};
  const inventory = normalizedPayload.inventory || {};

  const originalPrice = toNumber(price.original ?? rawPayload.originalPrice);
  const dealPrice = toNumber(price.amount ?? rawPayload.price ?? rawPayload.dealPrice);
  const discountPercentage =
    discount.type === 'percentage'
      ? toNumber(discount.value)
      : toNumber(rawPayload.discountPercentage ?? rawPayload.discount);

  const schedule = normalizedPayload.schedule || {};
  const scheduleRule = schedule.rule || {};
  const startDate =
    scheduleRule.startsAt ||
    rawPayload.startDate ||
    rawPayload.startsAt ||
    null;
  const endDate =
    scheduleRule.endsAt ||
    rawPayload.endDate ||
    rawPayload.endsAt ||
    null;

  const status =
    row.confidence != null && Number(row.confidence) >= 0.75
      ? 'active'
      : 'pending_review';

  const imageUrl = rawPayload.imageUrl || normalizedPayload.imageUrl || null;
  const terms = rawPayload.terms || normalizedPayload.terms || null;

  const sourceType = jobInfo.source || rawPayload.sourceType || 'web_crawl';
  const sourceReference = rawPayload.sourceUrl || normalizedPayload.sourceUrl || jobInfo.scope || null;

  const maxRedemptions =
    inventory.maxRedemptions ??
    inventory.max ??
    rawPayload.maxRedemptions ??
    null;

  const inventoryRemaining =
    inventory.remaining ??
    rawPayload.inventoryRemaining ??
    null;

  return {
    title,
    description,
    category,
    subcategory,
    originalPrice,
    dealPrice,
    discountPercentage,
    startDate,
    endDate,
    status,
    imageUrl,
    terms,
    sourceType,
    sourceReference,
    maxRedemptions,
    inventoryRemaining,
  };
};

const getJobInfo = async (client, cache, jobId) => {
  if (!jobId) return { source: null, scope: null };

  if (cache.has(jobId)) {
    return cache.get(jobId);
  }

  const { rows } = await client.query(
    `
      SELECT source, scope
      FROM ingestion_jobs
      WHERE id = $1
    `,
    [jobId]
  );

  const result = rows[0] ?? { source: null, scope: null };
  cache.set(jobId, result);
  return result;
};

const insertDeal = async (
  client,
  merchant,
  location,
  fields,
  row,
  rawPayload,
  normalizedPayload,
  confidence,
  jobInfo
) => {
  const sourceDetails = {
    jobId: row.job_id,
    scope: jobInfo.scope,
    normalizedPayload,
    rawPayload,
  };

  const { rows } = await client.query(
    `
      INSERT INTO deals (
        merchant_id,
        location_id,
        title,
        description,
        original_price,
        deal_price,
        discount_percentage,
        category,
        subcategory,
        start_date,
        end_date,
        max_redemptions,
        current_redemptions,
        status,
        visibility,
        source_type,
        source_reference,
        source_details,
        confidence_score,
        last_seen_at,
        inventory_remaining,
        image_url,
        terms_conditions
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, 0, $13, 'public', $14, $15, $16::jsonb,
        $17, NOW(), $18, $19, $20
      )
      RETURNING *
    `,
    [
      merchant.id,
      location ? location.id : null,
      fields.title,
      fields.description,
      fields.originalPrice,
      fields.dealPrice,
      fields.discountPercentage,
      fields.category,
      fields.subcategory,
      fields.startDate ? new Date(fields.startDate) : null,
      fields.endDate ? new Date(fields.endDate) : null,
      fields.maxRedemptions != null ? Number(fields.maxRedemptions) : null,
      fields.status,
      fields.sourceType,
      fields.sourceReference,
      JSON.stringify(sourceDetails),
      confidence != null ? Number(confidence) : null,
      fields.inventoryRemaining != null ? Number(fields.inventoryRemaining) : null,
      fields.imageUrl,
      fields.terms,
    ]
  );

  const deal = rows[0];

  await client.query(
    `
      INSERT INTO deal_sources (deal_id, source, raw_url, fetched_at, confidence, metadata)
      VALUES ($1, $2, $3, NOW(), $4, $5::jsonb)
    `,
    [
      deal.id,
      fields.sourceType,
      fields.sourceReference,
      confidence != null ? Number(confidence) : null,
      JSON.stringify({
        jobId: row.job_id,
        scope: jobInfo.scope,
        merchantAlias: row.merchant_alias || null,
      }),
    ]
  );

  return deal;
};

const promoteIngestedRows = async (rows) => {
  const client = await pool.connect();
  const jobCache = new Map();
  const stats = {
    fetched: rows.length,
    promoted: 0,
    errors: 0,
  };

  try {
    for (const row of rows) {
      const rawPayload = parseJsonColumn(row.raw_payload);
      const normalizedPayload = parseJsonColumn(row.normalized_payload);
      const alias = deriveAlias(row, rawPayload, normalizedPayload);

      try {
        await client.query('BEGIN');

        const jobInfo = await getJobInfo(client, jobCache, row.job_id);
        const merchant = await findOrCreateMerchant(client, alias, rawPayload, normalizedPayload, jobInfo.source);
        await ensureMerchantAlias(client, merchant.id, alias, jobInfo.source, row.confidence);
        const location = await findOrCreateLocation(client, merchant.id, rawPayload, normalizedPayload);

        const fields = extractDealFields(row, rawPayload, normalizedPayload, jobInfo);
        
        // Validate deal quality
        const qualityAssessment = assessDealQuality(fields, rawPayload, normalizedPayload);
        
        // Auto-reject if quality is too low (even for manual promotion attempts)
        if (qualityAssessment.shouldAutoReject) {
          await client.query('ROLLBACK');
          
          // Update status to auto_rejected
          await client.query(
            `
              UPDATE ingested_deal_raw
              SET status = 'auto_rejected',
                  normalized_payload = $1::jsonb
              WHERE id = $2
            `,
            [
              JSON.stringify({
                ...normalizedPayload,
                qualityAssessment,
                rejectionReason: `Quality score ${(qualityAssessment.score * 100).toFixed(0)}% below auto-reject threshold`,
              }),
              row.id,
            ]
          );
          
          await client.query('COMMIT');
          
          console.warn(
            `[dealPromotion] Auto-rejected deal ${row.id} (quality: ${(qualityAssessment.score * 100).toFixed(0)}%):`,
            qualityAssessment.reasons.join(', ')
          );
          
          stats.errors += 1;
          // Continue to next row (this one is auto-rejected)
          continue;
        }
        
        if (!qualityAssessment.valid) {
          // Log quality issues but don't fail - admin can still approve if above auto-reject threshold
          console.warn(
            `[dealPromotion] Deal quality check warning for row ${row.id}:`,
            qualityAssessment.reasons.join(', '),
            'Recommendations:',
            qualityAssessment.recommendations.join(', ')
          );
          
          // Store quality assessment in source_details for admin review
          if (!rawPayload.qualityAssessment) {
            rawPayload.qualityAssessment = qualityAssessment;
          }
        }
        
        // When manually promoted via admin, always set status to 'active' (admin approval overrides confidence)
        // But we can still log quality issues for admin awareness
        fields.status = 'active';
        
        // Ensure merchant exists (should always exist from findOrCreateMerchant above)
        if (!merchant || !merchant.id) {
          throw new Error(`Merchant not found/created for row ${row.id}`);
        }
        
        const deal = await insertDeal(
          client,
          merchant,
          location,
          fields,
          row,
          rawPayload,
          normalizedPayload,
          row.confidence,
          jobInfo
        );

        await client.query(
          `
            UPDATE ingested_deal_raw
            SET status = 'promoted',
                matched_merchant_id = $1,
                normalized_payload = $2::jsonb,
                confidence = $3
            WHERE id = $4
          `,
          [
            merchant.id,
            JSON.stringify(normalizedPayload),
            row.confidence != null ? Number(row.confidence) : null,
            row.id,
          ]
        );

        await client.query('COMMIT');
        stats.promoted += 1;
        console.log(`[dealPromotion] promoted deal ${deal.id} (merchant_id: ${deal.merchant_id}, status: ${deal.status}, end_date: ${deal.end_date}) from ingested row ${row.id}`);
      } catch (error) {
        await client.query('ROLLBACK');
        stats.errors += 1;
        console.error('[dealPromotion] failed to promote ingested row', row.id, error);

        await client.query(
          `
            UPDATE ingested_deal_raw
            SET status = 'error'
            WHERE id = $1
          `,
          [row.id]
        );

        await client.query(
          `
            INSERT INTO ingestion_errors (job_id, stage, error_message, payload)
            VALUES ($1, 'promotion', $2, $3::jsonb)
          `,
          [row.job_id, error.message, JSON.stringify(rawPayload)]
        );
      }
    }
  } finally {
    client.release();
  }

  return stats;
};

const promotePendingIngestedDeals = async ({ limit = 20 } = {}) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM ingested_deal_raw
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT $1
    `,
    [limit]
  );

  return promoteIngestedRows(rows);
};

const promoteIngestedDealsByIds = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { fetched: 0, promoted: 0, errors: 0 };
  }

  const { rows } = await pool.query(
    `
      SELECT *
      FROM ingested_deal_raw
      WHERE id = ANY($1::int[])
        AND status = 'pending'
    `,
    [ids]
  );

  return promoteIngestedRows(rows);
};

const rejectIngestedDealsByIds = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { updated: 0 };
  }

  const { rowCount } = await pool.query(
    `
      UPDATE ingested_deal_raw
      SET status = 'rejected'
      WHERE id = ANY($1::int[])
        AND status = 'pending'
    `,
    [ids]
  );

  return { updated: rowCount };
};

module.exports = {
  promotePendingIngestedDeals,
  promoteIngestedDealsByIds,
  rejectIngestedDealsByIds,
};


