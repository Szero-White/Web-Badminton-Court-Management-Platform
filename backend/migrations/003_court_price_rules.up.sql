CREATE TABLE IF NOT EXISTS court_price_rules (
    id BIGSERIAL PRIMARY KEY,
    court_id BIGINT NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    days_mask SMALLINT NOT NULL CHECK (days_mask BETWEEN 1 AND 127),
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    price BIGINT NOT NULL CHECK (price >= 0),
    priority INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 10000),
    effective_from DATE NULL,
    effective_to DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_rule_court_active
    ON court_price_rules(court_id, is_active);

CREATE INDEX IF NOT EXISTS idx_price_rule_priority
    ON court_price_rules(court_id, priority DESC);
