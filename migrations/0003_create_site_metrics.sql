CREATE TABLE IF NOT EXISTS site_metrics (
  metric TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO site_metrics (metric, value) VALUES ('portfolio_visits', 0);
