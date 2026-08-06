import { pgTable, varchar, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import type { TOAuth2AccessToken } from "@bogeychan/elysia-oauth2";

export const users = pgTable("users", {
  id: varchar("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  slackId: varchar("slack_id").unique(),
  hcaId: varchar("hca_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const session = pgTable("session", {
  id: varchar("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  oauthState: varchar("oauth_state"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const oauthToken = pgTable(
  "oauth_token",
  {
    id: varchar("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    provider: varchar("provider").notNull(),
    token: jsonb("token").$type<TOAuth2AccessToken>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("oauth_token_user_provider_unique").on(t.userId, t.provider),
  ],
);

export const table = { users, session, oauthToken } as const;
export type Table = typeof table;