-- PostgreSQL baseline schema. Keep this file aligned with internal/models.
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','staff','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS courts (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  court_type VARCHAR(20) NOT NULL,
  open_time VARCHAR(5) NOT NULL,
  close_time VARCHAR(5) NOT NULL,
  base_price BIGINT NOT NULL CHECK (base_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courts_active ON courts(is_active);
CREATE INDEX IF NOT EXISTS idx_courts_maintenance ON courts(is_maintenance);

CREATE TABLE IF NOT EXISTS time_slots (
  id BIGSERIAL PRIMARY KEY,
  court_id BIGINT NOT NULL REFERENCES courts(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  price BIGINT NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_time_slot_range CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_time_slots_start ON time_slots(start_time);
CREATE INDEX IF NOT EXISTS idx_timeslot_court_start ON time_slots(court_id, start_time);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_code VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  court_id BIGINT NOT NULL REFERENCES courts(id),
  time_slot_id BIGINT NOT NULL REFERENCES time_slots(id),
  customer_type VARCHAR(20) NOT NULL DEFAULT 'walk_in' CHECK (customer_type IN ('walk_in','monthly')),
  notes TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','checked_in','completed','canceled','no_show')),
  total_price BIGINT NOT NULL CHECK (total_price >= 0),
  deposit_paid BIGINT NOT NULL DEFAULT 0 CHECK (deposit_paid >= 0),
  remaining_due BIGINT NOT NULL DEFAULT 0 CHECK (remaining_due >= 0),
  expires_at TIMESTAMPTZ NULL,
  canceled_at TIMESTAMPTZ NULL,
  cancel_reason VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_court ON bookings(court_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_expires_at ON bookings(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_slot_active ON bookings(time_slot_id)
  WHERE status IN ('pending','confirmed','checked_in','completed');

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id),
  amount BIGINT NOT NULL,
  payment_for VARCHAR(30) NOT NULL,
  method VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL,
  reference VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);

CREATE TABLE IF NOT EXISTS beverages (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  price BIGINT NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  unit VARCHAR(20) NOT NULL DEFAULT 'chai',
  description VARCHAR(255) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beverages_active ON beverages(is_active);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  type VARCHAR(30) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  amount BIGINT NOT NULL,
  payment_method VARCHAR(30) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  shift VARCHAR(50) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_staff ON transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT NOT NULL DEFAULT 0,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  payload TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
