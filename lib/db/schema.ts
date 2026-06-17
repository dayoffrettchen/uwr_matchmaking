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
  name: text("name").notNull(),
  phone: text("phone").unique(),
  skillRating: integer("skill_rating").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const signups = pgTable(
  "signups",
  {
    id: serial("id").primaryKey(),
    trainingId: integer("training_id").notNull(),
    playerId: integer("player_id").notNull(),
    team: integer("team"),
    source: text("source").notNull().default("app"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueSignup: unique().on(t.trainingId, t.playerId),
  }),
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
export type Signup = typeof signups.$inferSelect
export type Message = typeof messages.$inferSelect
