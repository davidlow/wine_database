-- Migration 001: location_type, location_groups, new wine fields, wine_cuisine_tags
-- Run this in your Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to run on an existing database — uses ADD COLUMN IF NOT EXISTS and
-- CREATE TABLE IF NOT EXISTS so it won't fail if partly applied.

-- ── locations: new columns ──────────────────────────────────────────────────
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'standard';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS position_x REAL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS position_y REAL;

-- ── location_groups: new table (must exist before the FK below) ─────────────
CREATE TABLE IF NOT EXISTS location_groups (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  parent_id  TEXT REFERENCES location_groups(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_location_groups_profile ON location_groups(profile_id);
CREATE INDEX IF NOT EXISTS idx_location_groups_parent  ON location_groups(parent_id);

-- ── locations: FK to location_groups (added after table exists) ─────────────
ALTER TABLE locations ADD COLUMN IF NOT EXISTS hierarchy_group_id TEXT REFERENCES location_groups(id) ON DELETE SET NULL;

-- ── wines: new structural and pairing fields ────────────────────────────────
ALTER TABLE wines ADD COLUMN IF NOT EXISTS pairing_weight   TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS minerality       REAL;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS oak_influence    REAL;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS fruit_intensity  REAL;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS pairing_rationale TEXT;

-- ── wine_cuisine_tags: new table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_cuisine_tags (
  id         TEXT PRIMARY KEY,
  wine_id    TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL,
  source     TEXT DEFAULT 'manual',
  created_at TEXT,
  UNIQUE(wine_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_wct_wine_id ON wine_cuisine_tags(wine_id);
CREATE INDEX IF NOT EXISTS idx_wct_tag    ON wine_cuisine_tags(tag);
