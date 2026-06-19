-- Phase 2: PostgreSQL schema for pharmaceutical detailed scheduling
-- Run via migration tool once PERSISTENCE_PROVIDER=postgres is enabled.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS planning_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(64) NOT NULL UNIQUE,
  plant VARCHAR(16) NOT NULL,
  finished_good_material VARCHAR(64) NOT NULL,
  order_quantity NUMERIC(18, 3) NOT NULL,
  sap_order_number VARCHAR(64),
  source_system VARCHAR(32),
  source_object_type VARCHAR(64),
  source_object_id VARCHAR(128),
  source_payload JSONB,
  custom_attributes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(32) NOT NULL,
  changed_by VARCHAR(64) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  before_state JSONB,
  after_state JSONB
);

-- Additional entity tables follow the same pattern in Phase 2 migrations.
