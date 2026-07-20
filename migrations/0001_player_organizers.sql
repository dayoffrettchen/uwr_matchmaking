ALTER TABLE players ADD COLUMN IF NOT EXISTS is_organizer boolean NOT NULL DEFAULT false;
