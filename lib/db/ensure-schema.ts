import "server-only"

import { pool } from "@/lib/db"

let schemaReady: Promise<void> | null = null

const SCHEMA_STATEMENTS = [

  "ALTER TABLE players ADD COLUMN IF NOT EXISTS auth_user_id text",
  "ALTER TABLE players ADD COLUMN IF NOT EXISTS email text",
  "ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false",
  "ALTER TABLE players ADD COLUMN IF NOT EXISTS notes text",
  "ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()",
  "CREATE UNIQUE INDEX IF NOT EXISTS players_auth_user_id_unique ON players (auth_user_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS players_email_unique ON players (email)",
  `CREATE TABLE IF NOT EXISTS player_position_preferences (
    id serial PRIMARY KEY,
    player_id integer NOT NULL,
    position text NOT NULL,
    preference_order integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT player_position_preferences_player_position_unique UNIQUE (player_id, position)
  )`,  "ALTER TABLE players ADD COLUMN IF NOT EXISTS initial_rating_configured boolean NOT NULL DEFAULT false",
  `CREATE TABLE IF NOT EXISTS player_position_ratings (
    id serial PRIMARY KEY,
    player_id integer NOT NULL,
    position text NOT NULL,
    rating integer NOT NULL DEFAULT 1000,
    initial_rating integer NOT NULL DEFAULT 1000,
    games_played integer NOT NULL DEFAULT 0,
    wins integer NOT NULL DEFAULT 0,
    draws integer NOT NULL DEFAULT 0,
    losses integer NOT NULL DEFAULT 0,
    is_eligible boolean NOT NULL DEFAULT false,
    preference_order integer,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT player_position_ratings_player_position_unique UNIQUE (player_id, position)
  )`,
  `CREATE TABLE IF NOT EXISTS matches (
    id serial PRIMARY KEY,
    training_id integer,
    played_at timestamptz NOT NULL,
    team_1_score integer,
    team_2_score integer,
    status text NOT NULL DEFAULT 'draft',
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    finalized_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS match_players (
    id serial PRIMARY KEY,
    match_id integer NOT NULL,
    player_id integer NOT NULL,
    team integer NOT NULL,
    position text NOT NULL,
    lineup_type text NOT NULL DEFAULT 'active',
    rating_before integer,
    rating_after integer,
    rating_delta integer,
    goals integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT match_players_match_player_unique UNIQUE (match_id, player_id)
  )`,
  "ALTER TABLE signups ADD COLUMN IF NOT EXISTS assigned_position text",
  "ALTER TABLE signups ADD COLUMN IF NOT EXISTS lineup_type text",
  `INSERT INTO player_position_ratings (player_id, position)
   SELECT p.id, v.position
   FROM players p
   CROSS JOIN (VALUES ('goalkeeper'), ('defender'), ('forward')) AS v(position)
   ON CONFLICT (player_id, position) DO NOTHING`,
]

export async function ensureDatabaseSchema(): Promise<void> {
  schemaReady ??= (async () => {
    for (const statement of SCHEMA_STATEMENTS) {
      await pool.query(statement)
    }
  })()

  return schemaReady
}
