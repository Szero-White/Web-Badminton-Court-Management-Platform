ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_group_id VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS display_color VARCHAR(16) NOT NULL DEFAULT '#6f9f94';

CREATE INDEX IF NOT EXISTS idx_bookings_group ON bookings(booking_group_id);
