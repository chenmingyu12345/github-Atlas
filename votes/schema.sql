CREATE TABLE IF NOT EXISTS ballots (
  id INTEGER PRIMARY KEY,
  legacy_recommend INTEGER NOT NULL DEFAULT 0 CHECK (legacy_recommend >= 0),
  legacy_not_recommend INTEGER NOT NULL DEFAULT 0 CHECK (legacy_not_recommend >= 0)
);

CREATE TABLE IF NOT EXISTS votes (
  ballot_id INTEGER NOT NULL REFERENCES ballots(id),
  voter TEXT NOT NULL,
  choice INTEGER NOT NULL CHECK (choice IN (-1, 1)),
  PRIMARY KEY (ballot_id, voter)
);

CREATE INDEX IF NOT EXISTS votes_ballot_choice ON votes (ballot_id, choice);
