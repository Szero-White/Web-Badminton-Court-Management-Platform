ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS business_date DATE;

UPDATE transactions
SET business_date = (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
WHERE business_date IS NULL;

ALTER TABLE transactions
  ALTER COLUMN business_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_business_date
  ON transactions(business_date);
CREATE INDEX IF NOT EXISTS idx_transactions_staff_shift_business_date
  ON transactions(staff_id, shift, business_date);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS actor_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shift VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_date DATE;

UPDATE payments
SET business_date = (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
WHERE business_date IS NULL;

ALTER TABLE payments
  ALTER COLUMN business_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_actor_id ON payments(actor_id);
CREATE INDEX IF NOT EXISTS idx_payments_actor_role ON payments(actor_role);
CREATE INDEX IF NOT EXISTS idx_payments_shift ON payments(shift);
CREATE INDEX IF NOT EXISTS idx_payments_business_date ON payments(business_date);
CREATE INDEX IF NOT EXISTS idx_payments_actor_shift_business_date
  ON payments(actor_id, shift, business_date);
