DROP INDEX IF EXISTS idx_bookings_group;
ALTER TABLE bookings DROP COLUMN IF EXISTS display_color;
ALTER TABLE bookings DROP COLUMN IF EXISTS booking_group_id;
