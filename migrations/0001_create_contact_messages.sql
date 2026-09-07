CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
  email TEXT NOT NULL CHECK(length(email) <= 254),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 10 AND 2000),
  source_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'read', 'replied', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
ON contact_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_contact_messages_source_created
ON contact_messages(source_hash, created_at);

PRAGMA optimize;
