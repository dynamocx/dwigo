const sanitize = (value) => (typeof value === 'string' ? value.trim() : '');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const findMerchantByAlias = async (client, alias) => {
  if (!alias) return null;

  const { rows } = await client.query(
    `
      SELECT m.*
      FROM merchant_aliases a
      JOIN merchants m ON m.id = a.merchant_id
      WHERE LOWER(a.alias) = LOWER($1)
      LIMIT 1
    `,
    [alias]
  );

  if (rows.length > 0) {
    return rows[0];
  }

  const { rows: fallback } = await client.query(
    `
      SELECT *
      FROM merchants
      WHERE LOWER(business_name) = LOWER($1)
      LIMIT 1
    `,
    [alias]
  );

  return fallback[0] ?? null;
};

const insertMerchant = async (client, businessName, rawPayload = {}, normalizedPayload = {}) => {
  const contactName = sanitize(rawPayload.contactName || rawPayload.contact_name || '');
  const phone = sanitize(rawPayload.phone || rawPayload.phoneNumber || '');
  const website =
    rawPayload.website ||
    normalizedPayload.website ||
    rawPayload.sourceUrl ||
    normalizedPayload.sourceUrl ||
    null;
  const description = rawPayload.description || normalizedPayload.description || null;

  const address = sanitize(rawPayload.address || normalizedPayload.address?.line1 || '');
  const city = sanitize(rawPayload.city || normalizedPayload.location?.city || '');
  const state = sanitize(rawPayload.state || normalizedPayload.location?.state || '');
  const postalCode = sanitize(
    rawPayload.postalCode || rawPayload.zip || normalizedPayload.location?.postalCode || ''
  );
  const latitude = toNumber(normalizedPayload.location?.latitude ?? rawPayload.latitude);
  const longitude = toNumber(normalizedPayload.location?.longitude ?? rawPayload.longitude);

  const { rows } = await client.query(
    `
      INSERT INTO merchants (
        business_name,
        contact_name,
        phone,
        description,
        website,
        status,
        level,
        address,
        city,
        state,
        zip_code,
        latitude,
        longitude
      )
      VALUES ($1, $2, $3, $4, $5, 'imported', 1, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      businessName.slice(0, 255),
      contactName || null,
      phone || null,
      description,
      website,
      address || null,
      city || null,
      state || null,
      postalCode || null,
      latitude,
      longitude,
    ]
  );

  return rows[0];
};

const ensureMerchantAlias = async (client, merchantId, alias, source, confidence) => {
  if (!alias) return;

  // Ensure alias is a string to avoid type inference issues
  const aliasStr = String(alias);
  const sourceStr = source ? String(source) : null;

  await client.query(
    `
      INSERT INTO merchant_aliases (merchant_id, alias, source, confidence)
      SELECT $1, $2::VARCHAR, $3::VARCHAR, $4
      WHERE NOT EXISTS (
        SELECT 1 FROM merchant_aliases
        WHERE merchant_id = $1 AND LOWER(alias) = LOWER($2::VARCHAR)
      )
    `,
    [merchantId, aliasStr, sourceStr, confidence != null ? Number(confidence) : null]
  );
};

const extractAddress = (rawPayload = {}, normalizedPayload = {}) => {
  const normalizedLocation = normalizedPayload.location || {};
  const addressBlock = normalizedPayload.address || {};

  const addressLine1 =
    addressBlock.line1 ||
    rawPayload.addressLine1 ||
    rawPayload.address_line1 ||
    rawPayload.address ||
    null;

  const addressLine2 = addressBlock.line2 || rawPayload.addressLine2 || rawPayload.address_line2 || null;
  const city = normalizedLocation.city || rawPayload.city || null;
  const state = normalizedLocation.state || rawPayload.state || null;
  const postalCode = normalizedLocation.postalCode || rawPayload.postalCode || rawPayload.zip || null;
  const latitude = toNumber(normalizedLocation.latitude ?? rawPayload.latitude);
  const longitude = toNumber(normalizedLocation.longitude ?? rawPayload.longitude);

  return {
    address_line1: addressLine1 ? addressLine1.slice(0, 255) : null,
    address_line2: addressLine2 ? addressLine2.slice(0, 255) : null,
    city: city ? city.slice(0, 100) : null,
    state: state ? state.slice(0, 50) : null,
    postal_code: postalCode ? postalCode.slice(0, 20) : null,
    latitude,
    longitude,
  };
};

const findOrCreateLocation = async (client, merchantId, rawPayload = {}, normalizedPayload = {}) => {
  const address = extractAddress(rawPayload, normalizedPayload);

  if (!address.address_line1 && !address.city) {
    return null;
  }

  const { rows } = await client.query(
    `
      SELECT *
      FROM merchant_locations
      WHERE merchant_id = $1
        AND (
          (address_line1 IS NOT DISTINCT FROM $2 AND postal_code IS NOT DISTINCT FROM $3)
          OR (city IS NOT DISTINCT FROM $4 AND state IS NOT DISTINCT FROM $5)
        )
      LIMIT 1
    `,
    [merchantId, address.address_line1, address.postal_code, address.city, address.state]
  );

  if (rows.length > 0) {
    return rows[0];
  }

  const { rows: locationRows } = await client.query(
    `
      INSERT INTO merchant_locations (
        merchant_id,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        latitude,
        longitude,
        is_primary
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        NOT EXISTS (SELECT 1 FROM merchant_locations WHERE merchant_id = $1)
      )
      RETURNING *
    `,
    [
      merchantId,
      rawPayload.locationName || normalizedPayload.location?.name || null,
      address.address_line1,
      address.address_line2,
      address.city,
      address.state,
      address.postal_code,
      address.latitude,
      address.longitude,
    ]
  );

  return locationRows[0];
};

const findOrCreateMerchant = async (client, alias, rawPayload = {}, normalizedPayload = {}, source = null) => {
  const trimmedAlias = sanitize(alias);
  if (trimmedAlias) {
    const existing = await findMerchantByAlias(client, trimmedAlias);
    if (existing) {
      await ensureMerchantAlias(client, existing.id, trimmedAlias, source, rawPayload.confidence);
      return existing;
    }
  }

  const fallbackName =
    trimmedAlias ||
    normalizedPayload.merchantName ||
    rawPayload.merchantName ||
    rawPayload.businessName ||
    rawPayload.merchant ||
    rawPayload.title ||
    `Unclaimed Merchant ${Date.now()}`;

  const merchant = await insertMerchant(client, fallbackName, rawPayload, normalizedPayload);

  if (trimmedAlias) {
    await ensureMerchantAlias(client, merchant.id, trimmedAlias, source, rawPayload.confidence);
  }

  return merchant;
};

module.exports = {
  findOrCreateMerchant,
  ensureMerchantAlias,
  findOrCreateLocation,
};


