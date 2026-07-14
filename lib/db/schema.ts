import { boolean, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core"

export const trainings = pgTable("trainings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  location: text("location"),
  isOpen: boolean("is_open").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  authUserId: text("auth_user_id").unique(),
  email: text("email").unique(),
  name: text("name").notNull(),
  phone: text("phone").unique(),
  profileCompleted: boolean("profile_completed").notNull().default(false),
  notes: text("notes"),
  skillRating: integer("skill_rating").notNull().default(5),
  initialRatingConfigured: boolean("initial_rating_configured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const playerPositionPreferences = pgTable(
  "player_position_preferences",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id").notNull(),
    position: text("position").notNull(),
    preferenceOrder: integer("preference_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniquePlayerPositionPreference: unique().on(t.playerId, t.position) }),
)

export const playerPositionRatings = pgTable(
  "player_position_ratings",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id").notNull(),
    position: text("position").notNull(),
    rating: integer("rating").notNull().default(1000),
    initialRating: integer("initial_rating").notNull().default(1000),
    gamesPlayed: integer("games_played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    isEligible: boolean("is_eligible").notNull().default(false),
    preferenceOrder: integer("preference_order"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniquePlayerPosition: unique().on(t.playerId, t.position) }),
)

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  trainingId: integer("training_id"),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  team1Score: integer("team_1_score"),
  team2Score: integer("team_2_score"),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
})

export const matchPlayers = pgTable(
  "match_players",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    playerId: integer("player_id").notNull(),
    team: integer("team").notNull(),
    position: text("position").notNull(),
    lineupType: text("lineup_type").notNull().default("active"),
    rotationGroupId: integer("rotation_group_id"),
    rotationGroupType: text("rotation_group_type"),
    rotationOrder: integer("rotation_order"),
    startsInWater: boolean("starts_in_water"),
    ratingBefore: integer("rating_before"),
    ratingAfter: integer("rating_after"),
    ratingDelta: integer("rating_delta"),
    goals: integer("goals"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniqueMatchPlayer: unique().on(t.matchId, t.playerId) }),
)

export const signups = pgTable(
  "signups",
  {
    id: serial("id").primaryKey(),
    trainingId: integer("training_id").notNull(),
    playerId: integer("player_id").notNull(),
    team: integer("team"),
    assignedPosition: text("assigned_position"),
    lineupType: text("lineup_type"),
    rotationGroupId: integer("rotation_group_id"),
    rotationGroupType: text("rotation_group_type"),
    rotationOrder: integer("rotation_order"),
    startsInWater: boolean("starts_in_water"),
    source: text("source").notNull().default("app"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniqueSignup: unique().on(t.trainingId, t.playerId) }),
)

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  trainingId: integer("training_id"),
  playerName: text("player_name").notNull(),
  phone: text("phone"),
  body: text("body").notNull(),
  matched: boolean("matched").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Training = typeof trainings.$inferSelect
export type Player = typeof players.$inferSelect
export type PlayerPositionPreference = typeof playerPositionPreferences.$inferSelect
export type PlayerPositionRating = typeof playerPositionRatings.$inferSelect
export type Match = typeof matches.$inferSelect
export type MatchPlayer = typeof matchPlayers.$inferSelect
export type Signup = typeof signups.$inferSelect
export type Message = typeof messages.$inferSelect
