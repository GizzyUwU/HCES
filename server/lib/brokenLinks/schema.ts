import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const brokenProjectLinks = sqliteTable("broken_project_links", {
  url: text("url").primaryKey(),
  projectId: integer("project_id"),
  category: text("category"),
  status: integer("status"),
  checkedAt: integer("checked_at"),
});

export type BrokenProjectLink = typeof brokenProjectLinks.$inferSelect;
