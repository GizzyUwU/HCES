import { Database } from "bun:sqlite";
import { drizzle, type SQLiteBunDatabase } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export function brokenLinksDbPath(): string {
  if (process.env["BROKEN_LINKS_DB_PATH"])
    return process.env["BROKEN_LINKS_DB_PATH"];
  return join(process.cwd(), "data", "broken-links.sqlite");
}

let db: SQLiteBunDatabase | null = null;

export function getBrokenLinksDb(): SQLiteBunDatabase {
  if (db) return db;
  const path = brokenLinksDbPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {}
  const sqlite = new Database(path, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL;");
  sqlite.run(
    `CREATE TABLE IF NOT EXISTS broken_project_links (
      url TEXT PRIMARY KEY,
      project_id INTEGER,
      category TEXT,
      status INTEGER,
      checked_at INTEGER
    );`,
  );
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_broken_project_links_checked_at ON broken_project_links (checked_at);`,
  );
  db = drizzle({ client: sqlite });
  return db;
}
