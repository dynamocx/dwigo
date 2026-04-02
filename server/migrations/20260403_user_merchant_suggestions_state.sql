-- Add optional state/region for US-style addresses (run if 20260402 was already applied).
ALTER TABLE user_merchant_suggestions
  ADD COLUMN IF NOT EXISTS state VARCHAR(50);
