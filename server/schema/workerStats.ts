import { createId } from "@paralleldrive/cuid2";
import { index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { workers } from "./workers";

export const workerStats = pgTable(
  "worker_stats",
  {
    id: varchar("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workerId: varchar("worker_id").references(() => workers.id, { onDelete: "cascade" }).notNull(),
    scraper: varchar("scraper").notNull(),
    latencyMs: integer("latency_ms"),
    lastHit: timestamp("last_hit").defaultNow().notNull(),
  }, (table) => [
    index("workerstats_path_worker_idx").on(table.scraper, table.workerId, table.lastHit)
  ]
);
