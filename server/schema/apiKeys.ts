import { createId } from "@paralleldrive/cuid2";
import { pgTable, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: varchar("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prefix: varchar("prefix").notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
    label: varchar("label").default("Goog... No label set :(").notNull(),
    lastUsed: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("api_keys_user_idx").on(table.userId)],
);
