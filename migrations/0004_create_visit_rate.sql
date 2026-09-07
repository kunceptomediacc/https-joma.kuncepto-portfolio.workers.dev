CREATE TABLE IF NOT EXISTS visit_rate (
  source_hash TEXT PRIMARY KEY,
  last_hit TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visit_rate_last_hit
ON visit_rate(last_hit);

PRAGMA optimize;
