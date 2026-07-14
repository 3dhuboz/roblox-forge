PRAGMA foreign_keys = ON;

CREATE TABLE radar_captures (
  id TEXT PRIMARY KEY,
  source_attempt_id TEXT NOT NULL REFERENCES radar_source_attempts(id),
  captured_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (expires_at > captured_at),
  CHECK (length(payload_hash) = 71 AND payload_hash GLOB 'sha256:*')
) STRICT;

CREATE TABLE radar_observations (
  capture_id TEXT NOT NULL REFERENCES radar_captures(id),
  universe_id INTEGER NOT NULL CHECK (universe_id > 0),
  root_place_id INTEGER NOT NULL CHECK (root_place_id > 0),
  game_label TEXT NOT NULL,
  corpus_record_id TEXT NOT NULL REFERENCES radar_corpus_records(id),
  public_url TEXT NOT NULL,
  discovery_position INTEGER NOT NULL CHECK (discovery_position > 0),
  live_ccu INTEGER CHECK (live_ccu IS NULL OR live_ccu >= 0),
  visits INTEGER CHECK (visits IS NULL OR visits >= 0),
  favorites INTEGER CHECK (favorites IS NULL OR favorites >= 0),
  public_rating REAL CHECK (
    public_rating IS NULL OR (public_rating >= 0 AND public_rating <= 1)
  ),
  updated_at TEXT,
  evidence_id TEXT NOT NULL,
  pattern_tags_json TEXT NOT NULL CHECK (
    json_valid(pattern_tags_json) AND json_type(pattern_tags_json) = 'array'
  ),
  public_offers_json TEXT NOT NULL CHECK (
    json_valid(public_offers_json) AND json_type(public_offers_json) = 'array'
  ),
  discontinuities_json TEXT NOT NULL CHECK (
    json_valid(discontinuities_json) AND json_type(discontinuities_json) = 'array'
  ),
  CHECK (
    public_url = ('https://www.roblox.com/games/' || root_place_id)
    OR public_url GLOB ('https://www.roblox.com/games/' || root_place_id || '/*')
  ),
  PRIMARY KEY (capture_id, universe_id),
  UNIQUE (capture_id, root_place_id),
  UNIQUE (capture_id, discovery_position),
  UNIQUE (evidence_id)
) STRICT;

CREATE TABLE radar_snapshots (
  id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL UNIQUE REFERENCES radar_captures(id),
  payload_json TEXT NOT NULL CHECK (
    json_valid(payload_json) AND json_type(payload_json) = 'object'
  ),
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(payload_hash) = 71 AND payload_hash GLOB 'sha256:*')
) STRICT;

CREATE VIEW radar_ordinal_scores AS
SELECT
  snapshot.id AS snapshot_id,
  json_extract(entry.value, '$.id') AS entry_id,
  json_extract(score.value, '$.dimension') AS dimension,
  json_extract(score.value, '$.score') AS score,
  json_extract(score.value, '$.confidence') AS confidence,
  json_extract(score.value, '$.evidenceIds') AS evidence_ids_json,
  json_extract(score.value, '$.asOf') AS as_of
FROM radar_snapshots AS snapshot,
  json_each(snapshot.payload_json, '$.entries') AS entry,
  json_each(entry.value, '$.ordinalScores') AS score;

CREATE INDEX radar_captures_time_idx
  ON radar_captures (captured_at DESC);

CREATE INDEX radar_snapshots_created_idx
  ON radar_snapshots (created_at DESC);

CREATE TRIGGER radar_captures_require_succeeded_attempt
BEFORE INSERT ON radar_captures
WHEN COALESCE(
  (SELECT status FROM radar_source_attempts WHERE id = NEW.source_attempt_id),
  ''
) <> 'succeeded'
BEGIN
  SELECT RAISE(ABORT, 'radar_capture_requires_succeeded_attempt');
END;

CREATE TRIGGER radar_snapshots_require_matching_capture
BEFORE INSERT ON radar_snapshots
WHEN
  json_extract(NEW.payload_json, '$.schemaVersion') IS NOT '1.0.0'
  OR json_extract(NEW.payload_json, '$.id') IS NOT NEW.id
  OR json_extract(NEW.payload_json, '$.asOf') IS NOT (
    SELECT captured_at FROM radar_captures WHERE id = NEW.capture_id
  )
  OR json_extract(NEW.payload_json, '$.expiresAt') IS NOT (
    SELECT expires_at FROM radar_captures WHERE id = NEW.capture_id
  )
BEGIN
  SELECT RAISE(ABORT, 'radar_snapshot_capture_mismatch');
END;

-- Canonical JSON Schema validation remains mandatory in persistence.ts. This
-- trigger is a D1 structural backstop against bypassing that sole write path.
CREATE TRIGGER radar_snapshots_require_contract_shape
BEFORE INSERT ON radar_snapshots
WHEN
  json_type(NEW.payload_json, '$.schemaVersion') IS NOT 'text'
  OR json_extract(NEW.payload_json, '$.schemaVersion') IS NOT '1.0.0'
  OR json_type(NEW.payload_json, '$.id') IS NOT 'text'
  OR json_type(NEW.payload_json, '$.asOf') IS NOT 'text'
  OR json_type(NEW.payload_json, '$.expiresAt') IS NOT 'text'
  OR json_type(NEW.payload_json, '$.corpusRecordIds') IS NOT 'array'
  OR json_array_length(NEW.payload_json, '$.corpusRecordIds') NOT BETWEEN 1 AND 64
  OR json_type(NEW.payload_json, '$.entries') IS NOT 'array'
  OR json_array_length(NEW.payload_json, '$.entries') NOT BETWEEN 1 AND 32
  OR json_type(NEW.payload_json, '$.provenance') IS NOT 'object'
  OR json_type(NEW.payload_json, '$.provenance.provenanceId') IS NOT 'text'
  OR json_type(NEW.payload_json, '$.provenance.evidenceIds') IS NOT 'array'
  OR json_array_length(NEW.payload_json, '$.provenance.evidenceIds') NOT BETWEEN 1 AND 640
  OR json_type(NEW.payload_json, '$.provenance.traceIds') IS NOT 'array'
  OR json_array_length(NEW.payload_json, '$.provenance.traceIds') NOT BETWEEN 1 AND 64
  OR json_type(NEW.payload_json, '$.createdAt') IS NOT 'text'
  OR EXISTS (
    SELECT 1 FROM json_each(NEW.payload_json)
    WHERE key NOT IN (
      'schemaVersion', 'id', 'asOf', 'expiresAt', 'corpusRecordIds',
      'entries', 'provenance', 'createdAt'
    )
  )
  OR EXISTS (
    SELECT 1 FROM json_each(NEW.payload_json, '$.entries') AS entry
    WHERE
      json_type(entry.value) IS NOT 'object'
      OR json_type(entry.value, '$.id') IS NOT 'text'
      OR json_type(entry.value, '$.universeId') IS NOT 'integer'
      OR json_type(entry.value, '$.rootPlaceId') IS NOT 'integer'
      OR json_type(entry.value, '$.gameLabel') IS NOT 'text'
      OR json_type(entry.value, '$.publicUrl') IS NOT 'text'
      OR json_type(entry.value, '$.signals') IS NOT 'array'
      OR json_array_length(entry.value, '$.signals') NOT BETWEEN 1 AND 24
      OR json_type(entry.value, '$.ordinalScores') IS NOT 'array'
      OR json_array_length(entry.value, '$.ordinalScores') NOT BETWEEN 1 AND 8
      OR json_type(entry.value, '$.patternTags') IS NOT 'array'
      OR json_array_length(entry.value, '$.patternTags') > 32
      OR json_type(entry.value, '$.publicOffers') IS NOT 'array'
      OR json_array_length(entry.value, '$.publicOffers') > 18
      OR json_type(entry.value, '$.discontinuities') IS NOT 'array'
      OR json_array_length(entry.value, '$.discontinuities') > 2
  )
BEGIN
  SELECT RAISE(ABORT, 'radar_snapshot_contract_shape_invalid');
END;

CREATE TRIGGER radar_captures_immutable_update
BEFORE UPDATE ON radar_captures
BEGIN
  SELECT RAISE(ABORT, 'radar_captures_are_immutable');
END;

CREATE TRIGGER radar_captures_immutable_delete
BEFORE DELETE ON radar_captures
BEGIN
  SELECT RAISE(ABORT, 'radar_captures_are_immutable');
END;

CREATE TRIGGER radar_observations_immutable_update
BEFORE UPDATE ON radar_observations
BEGIN
  SELECT RAISE(ABORT, 'radar_observations_are_immutable');
END;

CREATE TRIGGER radar_observations_immutable_delete
BEFORE DELETE ON radar_observations
BEGIN
  SELECT RAISE(ABORT, 'radar_observations_are_immutable');
END;

CREATE TRIGGER radar_snapshots_immutable_update
BEFORE UPDATE ON radar_snapshots
BEGIN
  SELECT RAISE(ABORT, 'radar_snapshots_are_immutable');
END;

CREATE TRIGGER radar_snapshots_immutable_delete
BEFORE DELETE ON radar_snapshots
BEGIN
  SELECT RAISE(ABORT, 'radar_snapshots_are_immutable');
END;
