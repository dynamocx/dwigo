const pool = require('../config/database');
const { assessDealQuality, AUTO_REJECT_QUALITY_SCORE } = require('./dealQuality');

const insertIngestionJob = async (client, { source, scope }) => {
  const { rows } = await client.query(
    `
      INSERT INTO ingestion_jobs (source, scope, status, started_at)
      VALUES ($1, $2, 'running', NOW())
      RETURNING *
    `,
    [source, scope ?? null]
  );
  return rows[0];
};

const insertRawDeal = async (client, jobId, deal) => {
  const {
    merchantAlias = null,
    merchant_alias = null,
    rawPayload = undefined,
    raw_payload = undefined,
    normalizedPayload = undefined,
    normalized_payload = undefined,
    confidence = null,
    matchedMerchantId = null,
    matched_merchant_id = null,
    status = 'pending',
  } = deal;

  const alias = merchantAlias ?? merchant_alias ?? null;
  const raw = rawPayload ?? raw_payload ?? deal;
  const normalized = normalizedPayload ?? normalized_payload ?? null;
  const matchedId = matchedMerchantId ?? matched_merchant_id ?? null;

  await client.query(
    `
      INSERT INTO ingested_deal_raw (
        job_id,
        merchant_alias,
        raw_payload,
        normalized_payload,
        status,
        matched_merchant_id,
        confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [jobId, alias, raw, normalized, status, matchedId, confidence != null ? Number(confidence) : null]
  );
};

const recordIngestionError = async (client, jobId, stage, error, payload = null) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // Truncate stage if needed (VARCHAR(50))
  const truncatedStage = String(stage).substring(0, 50);
  await client.query(
    `
      INSERT INTO ingestion_errors (job_id, stage, error_message, payload)
      VALUES ($1, $2, $3, $4)
    `,
    [jobId, truncatedStage, errorMessage, payload ? JSON.stringify(payload) : null]
  );
};

const finalizeJob = async (client, jobId, status, stats) => {
  await client.query(
    `
      UPDATE ingestion_jobs
      SET status = $1,
          stats = $2::jsonb,
          finished_at = NOW()
      WHERE id = $3
    `,
    [status, JSON.stringify(stats ?? {}), jobId]
  );
};

const processIngestionJob = async ({ source, scope = null, deals = [] } = {}) => {
  if (!source) {
    throw new Error('source is required to process ingestion job');
  }

  const client = await pool.connect();
  let job;
  const stats = {
    total: Array.isArray(deals) ? deals.length : 0,
    recorded: 0,
    errors: 0,
  };

  try {
    job = await insertIngestionJob(client, { source, scope });

    if (!Array.isArray(deals) || deals.length === 0) {
      await finalizeJob(client, job.id, 'succeeded', stats);
      return { jobId: job.id, stats };
    }

    for (const deal of deals) {
      try {
        // Check deal quality before inserting
        const rawPayload = deal.rawPayload || deal.raw_payload || {};
        const normalizedPayload = deal.normalizedPayload || deal.normalized_payload || null;
        
        // Validate and fix dates during ingestion (not just promotion)
        const now = new Date();
        let startDate = rawPayload.startDate || rawPayload.startsAt || normalizedPayload?.schedule?.rule?.startsAt || null;
        let endDate = rawPayload.endDate || rawPayload.endsAt || normalizedPayload?.schedule?.rule?.endsAt || null;
        
        if (startDate) {
          const parsedStart = new Date(startDate);
          if (parsedStart < now || parsedStart.getFullYear() < 2025) {
            console.warn(`[ingestion] Fixing invalid startDate during ingestion: ${startDate} -> ${now.toISOString()}`);
            rawPayload.startDate = now.toISOString();
            startDate = now.toISOString();
          }
        } else {
          rawPayload.startDate = now.toISOString();
          startDate = now.toISOString();
        }
        
        if (endDate) {
          const parsedEnd = new Date(endDate);
          const parsedStart = new Date(startDate);
          if (parsedEnd <= parsedStart || parsedEnd.getFullYear() < 2025) {
            const fixedEnd = new Date(parsedStart);
            fixedEnd.setDate(fixedEnd.getDate() + 60);
            console.warn(`[ingestion] Fixing invalid endDate during ingestion: ${endDate} -> ${fixedEnd.toISOString()}`);
            rawPayload.endDate = fixedEnd.toISOString();
            endDate = fixedEnd.toISOString();
          }
        } else {
          const defaultEnd = new Date(startDate);
          defaultEnd.setDate(defaultEnd.getDate() + 60);
          rawPayload.endDate = defaultEnd.toISOString();
          endDate = defaultEnd.toISOString();
        }
        
        // Extract basic fields for quality check
        const fields = {
          title: normalizedPayload?.title || rawPayload.title || null,
          description: normalizedPayload?.description || rawPayload.description || null,
          discountPercentage: 
            normalizedPayload?.discount?.value || 
            rawPayload.discountPercentage || 
            rawPayload.discount || 
            null,
          originalPrice: 
            normalizedPayload?.price?.original || 
            rawPayload.originalPrice || 
            null,
          dealPrice: 
            normalizedPayload?.price?.amount || 
            rawPayload.price || 
            rawPayload.dealPrice || 
            null,
          category: normalizedPayload?.category || rawPayload.category || null,
          endDate: endDate, // Use validated date
          terms: normalizedPayload?.terms || rawPayload.terms || null,
        };
        
        const qualityAssessment = assessDealQuality(fields, rawPayload, normalizedPayload);
        
        // Debug logging
        if (qualityAssessment.shouldAutoReject) {
          console.log(
            `[ingestion] Quality check: Deal "${fields.title || 'Untitled'}" scored ${(qualityAssessment.score * 100).toFixed(0)}% - will auto-reject`
          );
        }
        
        // Auto-reject deals below quality threshold
        if (qualityAssessment.shouldAutoReject) {
          // Insert as rejected with quality reasons
          await client.query(
            `
              INSERT INTO ingested_deal_raw (
                job_id,
                merchant_alias,
                raw_payload,
                normalized_payload,
                status,
                matched_merchant_id,
                confidence
              )
              VALUES ($1, $2, $3, $4, 'auto_rejected', $5, $6)
            `,
            [
              job.id,
              deal.merchantAlias || deal.merchant_alias || null,
              rawPayload,
              normalizedPayload,
              null,
              deal.confidence != null ? Number(deal.confidence) : null,
            ]
          );
          
          // Log rejection reason (truncate if needed)
          const rejectionMessage = `Auto-rejected: Quality ${(qualityAssessment.score * 100).toFixed(0)}% < ${(AUTO_REJECT_QUALITY_SCORE * 100).toFixed(0)}%. Issues: ${qualityAssessment.reasons.slice(0, 3).join(', ')}`;
          await recordIngestionError(
            client,
            job.id,
            'quality_check',
            rejectionMessage,
            { qualityAssessment, deal }
          );
          
          stats.errors += 1;
          console.log(
            `[ingestion] Auto-rejected deal "${fields.title || 'Untitled'}" (quality: ${(qualityAssessment.score * 100).toFixed(0)}%)`
          );
          // Continue to next deal (already inserted as auto_rejected)
          continue;
        }
        
        // Insert as pending if quality is acceptable
        await insertRawDeal(client, job.id, deal);
        stats.recorded += 1;
      } catch (rawError) {
        stats.errors += 1;
        await recordIngestionError(client, job.id, 'raw_insert', rawError, deal);
      }
    }

    const status = stats.errors > 0 ? 'has_errors' : 'succeeded';
    await finalizeJob(client, job.id, status, stats);

    return { jobId: job.id, stats };
  } catch (error) {
    if (job?.id) {
      stats.errors += 1;
      await recordIngestionError(client, job.id, 'job', error);
      await finalizeJob(client, job.id, 'failed', stats);
    }
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  processIngestionJob,
};


