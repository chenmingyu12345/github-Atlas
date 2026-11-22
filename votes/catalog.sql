CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  bookmark_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('online','skill','project')),
  task TEXT NOT NULL,
  audiences TEXT NOT NULL CHECK (json_valid(audiences)),
  description TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  keywords TEXT NOT NULL,
  repository TEXT,
  stars INTEGER CHECK (stars IS NULL OR stars >= 0),
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
  ballot_id INTEGER UNIQUE REFERENCES ballots(id),
  position INTEGER NOT NULL DEFAULT 100000,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER IF NOT EXISTS resources_skill_ballot_insert
AFTER INSERT ON resources WHEN NEW.kind = 'skill' AND NEW.ballot_id IS NULL
BEGIN
  INSERT INTO ballots (legacy_recommend, legacy_not_recommend) VALUES (0,0);
  UPDATE resources SET ballot_id = last_insert_rowid() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS resources_skill_ballot_update
AFTER UPDATE OF kind ON resources WHEN NEW.kind = 'skill' AND NEW.ballot_id IS NULL
BEGIN
  INSERT INTO ballots (legacy_recommend, legacy_not_recommend) VALUES (0,0);
  UPDATE resources SET ballot_id = last_insert_rowid() WHERE id = NEW.id;
END;
