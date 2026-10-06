import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Static } from "elysia";
import { SDTypes } from "@server/scrapers/stardance/types";
import { logger } from "@server/lib/logger";

export const GOI_REVIEW_CHECK_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const PROBE_CONCURRENCY = 6;
const MAX_CHECKS_PER_JOB = 60;
const STARDANCE_BASE_URL = "https://stardance.hackclub.com";

export type ReviewLinkStatus = {
  reviewId: number;
  url: string;
  status: number;
  checkedAt: number;
};

type GoiStatsBody = Static<(typeof SDTypes)["GoiStats"]> & {
  queueEntries?: Static<(typeof SDTypes)["GoiQueueEntry"]>[];
};

function dbPath(): string {
  if (process.env["GOI_REVIEW_DB_PATH"]) return process.env["GOI_REVIEW_DB_PATH"];
  return join(process.cwd(), "data", "goi-review-links.sqlite");
}

let db: Database | null = null;

function getReviewLinkDb(): Database {
  if (db) return db;
  const path = dbPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
  }
  db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  db.run(`
    CREATE TABLE IF NOT EXISTS review_link_status (
      review_id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      status INTEGER NOT NULL,
      checked_at INTEGER NOT NULL
    );
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_review_link_status_checked_at ON review_link_status (checked_at);`,
  );
  return db;
}

export function isFresh(checkedAt: number, now = Date.now()): boolean {
  return now - checkedAt < GOI_REVIEW_CHECK_TTL_MS;
}

export function isBrokenStatus(status: number): boolean {
  return status === 404 || status >= 500;
}

function getCachedReviewStatus(reviewId: number): ReviewLinkStatus | null {
  try {
    const row = getReviewLinkDb()
      .query<
        ReviewLinkStatus,
        [number]
      >(`SELECT review_id as reviewId, url, status, checked_at as checkedAt FROM review_link_status WHERE review_id = ?`)
      .get(reviewId);
    if (!row) return null;
    if (!isFresh(row.checkedAt)) return null;
    return row;
  } catch {
    return null;
  }
}

function getStoredReviewStatus(reviewId: number): ReviewLinkStatus | null {
  try {
    const row = getReviewLinkDb()
      .query<
        ReviewLinkStatus,
        [number]
      >(`SELECT review_id as reviewId, url, status, checked_at as checkedAt FROM review_link_status WHERE review_id = ?`)
      .get(reviewId);
    return row ?? null;
  } catch {
    return null;
  }
}

function setCachedReviewStatus(entry: ReviewLinkStatus): void {
  getReviewLinkDb()
    .query(
      `INSERT INTO review_link_status (review_id, url, status, checked_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(review_id) DO UPDATE SET url = excluded.url, status = excluded.status, checked_at = excluded.checked_at`,
    )
    .run(entry.reviewId, entry.url, entry.status, entry.checkedAt);
}

async function probeReviewStatus(
  path: string,
  cookie: string,
): Promise<number | null> {
  try {
    const res = await fetch(STARDANCE_BASE_URL + path, {
      headers: { Cookie: cookie },
    });
    const status = res.status;
    try {
      await res.body?.cancel();
    } catch {
    }
    return status;
  } catch (err) {
    logger.warn("Failed checking GOI review link", { path, error: err });
    return null;
  }
}

export function applyBrokenLinkStats(
  body: GoiStatsBody,
): Static<(typeof SDTypes)["GoiStats"]> {
  const entries = (body.queueEntries ?? []).filter(
    (e) => Number.isFinite(e.reviewId) && e.reviewId > 0 && !!e.url,
  );

  const statuses = new Map<number, number>();
  for (const e of entries) {
    if (statuses.has(e.reviewId)) continue;
    const stored = getStoredReviewStatus(e.reviewId);
    if (stored) statuses.set(e.reviewId, stored.status);
  }

  let brokenCount = 0;
  let brokenHours = 0;
  let brokenDevlogs = 0;
  const brokenByType = new Map<
    string,
    { count: number; hours: number; devlogs: number }
  >();

  for (const e of entries) {
    const status = statuses.get(e.reviewId);
    if (status === undefined || !isBrokenStatus(status)) continue;
    brokenCount += 1;
    brokenHours += e.hours;
    brokenDevlogs += e.devlogs;
    const cat = brokenByType.get(e.type) ?? { count: 0, hours: 0, devlogs: 0 };
    cat.count += 1;
    cat.hours += e.hours;
    cat.devlogs += e.devlogs;
    brokenByType.set(e.type, cat);
  }

  const { queueEntries: _internalEntries, ...rest } = body;
  void _internalEntries;
  return {
    ...rest,
    queueCountExcludingBroken: rest.queueCount - brokenCount,
    brokenCount,
    pendingHoursExcludingBroken: rest.pendingHours - brokenHours,
    pendingDevlogsExcludingBroken: rest.pendingDevlogs - brokenDevlogs,
    categories: rest.categories.map((cat) => {
      const catBroken = brokenByType.get(cat.type) ?? {
        count: 0,
        hours: 0,
        devlogs: 0,
      };
      return {
        ...cat,
        countExcludingBroken: cat.count - catBroken.count,
        brokenCount: catBroken.count,
        pendingHoursExcludingBroken: cat.pendingHours - catBroken.hours,
        pendingDevlogsExcludingBroken: cat.pendingDevlogs - catBroken.devlogs,
      };
    }),
  };
}

const refreshInFlight = new Set<number>();

export function refreshReviewLinksInBackground(
  entries: { reviewId: number; url: string }[],
  cookie: string,
): void {
  if (!cookie) return;
  const toCheck: { reviewId: number; url: string }[] = [];
  const seen = new Set<number>();
  for (const e of entries) {
    if (!Number.isFinite(e.reviewId) || e.reviewId <= 0 || !e.url) continue;
    if (seen.has(e.reviewId) || refreshInFlight.has(e.reviewId)) continue;
    seen.add(e.reviewId);
    if (getCachedReviewStatus(e.reviewId)) continue;
    toCheck.push({ reviewId: e.reviewId, url: e.url });
  }
  const batch = toCheck.slice(0, MAX_CHECKS_PER_JOB);
  if (batch.length === 0) return;
  for (const item of batch) refreshInFlight.add(item.reviewId);

  void (async () => {
    try {
      for (let i = 0; i < batch.length; i += PROBE_CONCURRENCY) {
        const chunk = batch.slice(i, i + PROBE_CONCURRENCY);
        const settled = await Promise.all(
          chunk.map(async (item) => ({
            item,
            status: await probeReviewStatus(item.url, cookie),
          })),
        );
        const at = Date.now();
        for (const { item, status } of settled) {
          if (status == null) continue;
          try {
            setCachedReviewStatus({
              reviewId: item.reviewId,
              url: item.url,
              status,
              checkedAt: at,
            });
          } catch (err) {
            logger.warn("Failed caching GOI review link status", {
              reviewId: item.reviewId,
              error: err,
            });
          }
        }
      }
    } catch (err) {
      logger.warn("Background GOI review link refresh failed", {
        error: err,
      });
    } finally {
      for (const item of batch) refreshInFlight.delete(item.reviewId);
    }
  })();
}
