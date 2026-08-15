import { createId } from "@paralleldrive/cuid2";
import { boolean, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const workers = pgTable(
  "workers",
  {
    id: varchar("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    prefix: varchar("prefix").notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
    label: varchar("label").default("Goog... No label set :(").notNull(),
    connected: boolean("connected").default(false).notNull(),
    lastConnectedAt: timestamp("last_connected_at"),
    versionSHA: varchar("versionSHA"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);
