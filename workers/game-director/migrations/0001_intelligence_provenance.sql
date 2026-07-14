PRAGMA foreign_keys = ON;

CREATE TABLE radar_source_attempts (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (source_kind = 'roblox_public_chart'),
  public_sort TEXT NOT NULL CHECK (public_sort IN ('top_playing_now', 'top_trending')),
  source_url TEXT NOT NULL,
  capture_mode TEXT NOT NULL CHECK (capture_mode IN ('browser_rendered', 'manual_verified')),
  locale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  error_code TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  CHECK (locale <> '' AND length(locale) <= 32),
  CHECK (
    (public_sort = 'top_playing_now' AND source_url = 'https://www.roblox.com/charts/top-playing-now')
    OR (public_sort = 'top_trending' AND source_url = 'https://www.roblox.com/charts/top-trending')
  ),
  CHECK (
    (status = 'failed' AND error_code IS NOT NULL AND finished_at IS NOT NULL)
    OR (status = 'succeeded' AND error_code IS NULL AND finished_at IS NOT NULL)
  )
) STRICT;

CREATE TABLE radar_corpus_records (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_publisher TEXT NOT NULL CHECK (source_publisher = 'Roblox'),
  observed_at TEXT NOT NULL,
  public_metadata_json TEXT NOT NULL CHECK (json_valid(public_metadata_json)),
  pattern_tags_json TEXT NOT NULL CHECK (json_valid(pattern_tags_json)),
  provenance_json TEXT NOT NULL CHECK (json_valid(provenance_json)),
  created_at TEXT NOT NULL,
  CHECK (source_url GLOB 'https://www.roblox.com/*')
) STRICT;

CREATE INDEX radar_source_attempts_sort_time_idx
  ON radar_source_attempts (public_sort, started_at DESC);

CREATE INDEX radar_corpus_records_observed_idx
  ON radar_corpus_records (observed_at DESC);

CREATE TRIGGER radar_source_attempts_immutable_update
BEFORE UPDATE ON radar_source_attempts
BEGIN
  SELECT RAISE(ABORT, 'radar_source_attempts_are_immutable');
END;

CREATE TRIGGER radar_source_attempts_immutable_delete
BEFORE DELETE ON radar_source_attempts
BEGIN
  SELECT RAISE(ABORT, 'radar_source_attempts_are_immutable');
END;

CREATE TRIGGER radar_corpus_records_immutable_update
BEFORE UPDATE ON radar_corpus_records
BEGIN
  SELECT RAISE(ABORT, 'radar_corpus_records_are_immutable');
END;

CREATE TRIGGER radar_corpus_records_immutable_delete
BEFORE DELETE ON radar_corpus_records
BEGIN
  SELECT RAISE(ABORT, 'radar_corpus_records_are_immutable');
END;
