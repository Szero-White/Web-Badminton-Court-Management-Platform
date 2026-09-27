DROP INDEX IF EXISTS idx_payments_actor_shift_business_date;
DROP INDEX IF EXISTS idx_payments_business_date;
DROP INDEX IF EXISTS idx_payments_shift;
DROP INDEX IF EXISTS idx_payments_actor_role;
DROP INDEX IF EXISTS idx_payments_actor_id;
ALTER TABLE payments DROP COLUMN IF EXISTS business_date;
ALTER TABLE payments DROP COLUMN IF EXISTS shift;
ALTER TABLE payments DROP COLUMN IF EXISTS actor_role;
ALTER TABLE payments DROP COLUMN IF EXISTS actor_id;

DROP INDEX IF EXISTS idx_transactions_staff_shift_business_date;
DROP INDEX IF EXISTS idx_transactions_business_date;
ALTER TABLE transactions DROP COLUMN IF EXISTS business_date;
