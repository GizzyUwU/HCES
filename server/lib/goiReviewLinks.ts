import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Static } from "elysia";
import { SDTypes } from "@server/scrapers/stardance/types";
import { logger } from "@server/lib/logger";
export const GOI_REVIEW_CHECK_TTL_MS = 2 * 24 * 60 * 60 * 1000;
export const GOI_REVIEW_CHECK_INTERVAL_MS = 5 * 60 * 1000;
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
  if (process.env["GOI_REVIEW_DB_PATH"])
    return process.env["GOI_REVIEW_DB_PATH"];
  return join(process.cwd(), "data", "goi-review-links.sqlite");
}
let db: Database | null = null;
function getReviewLinkDb(): Database {
  if (db) return db;
  const path = dbPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {}
  db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  db.run(
    ` CREATE TABLE IF NOT EXISTS review_link_status ( review_id INTEGER PRIMARY KEY, url TEXT NOT NULL, status INTEGER NOT NULL, checked_at INTEGER NOT NULL ); `,
  );
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
      .query<ReviewLinkStatus, [number]>(
        `SELECT review_id as reviewId, url, status, checked_at as checkedAt FROM review_link_status WHERE review_id = ?`,
      )
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
      .query<ReviewLinkStatus, [number]>(
        `SELECT review_id as reviewId, url, status, checked_at as checkedAt FROM review_link_status WHERE review_id = ?`,
      )
      .get(reviewId);
    return row ?? null;
  } catch {
    return null;
  }
}
function setCachedReviewStatus(entry: ReviewLinkStatus): void {
  getReviewLinkDb()
    .query(
      `INSERT INTO review_link_status (review_id, url, status, checked_at) VALUES (?, ?, ?, ?) ON CONFLICT(review_id) DO UPDATE SET url = excluded.url, status = excluded.status, checked_at = excluded.checked_at`,
    )
    .run(entry.reviewId, entry.url, entry.status, entry.checkedAt);
}
async function releaseReviewClaim(
  reviewId: number,
  cookie: string,
): Promise<boolean> {
  const body = new URLSearchParams();
  body.set("_method", "delete");
  try {
    const res = await fetch(
      `${STARDANCE_BASE_URL}/admin/certification/review/${reviewId}/claim`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    if (res.status === 404 || res.status === 410) {
      return true;
    }
    return res.ok;
  } catch (err) {
    logger.warn("Failed releasing GOI review claim", { reviewId, error: err });
    return false;
  }
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
    } catch {}
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
  if (entries.length === 0 && body.queueCount > 0) {
    logger.warn(
      "GOI queue has rows but no queueEntries were scraped; check ID/link selectors",
      { queueCount: body.queueCount },
    );
  }
  const statuses = new Map<number, number>();
  for (const e of entries) {
    if (statuses.has(e.reviewId)) continue;
    const stored = getStoredReviewStatus(e.reviewId);
    if (stored) {
      statuses.set(e.reviewId, stored.status);
    }
  }
  let brokenCount = 0;
  let brokenHours = 0;
  let brokenDevlogs = 0;
  let checkedCount = 0;
  const brokenByType = new Map<
    string,
    {
      count: number;
      hours: number;
      devlogs: number;
      checked: number;
      total: number;
    }
  >();
  for (const e of entries) {
    const status = statuses.get(e.reviewId);
    const cat = brokenByType.get(e.type) ?? {
      count: 0,
      hours: 0,
      devlogs: 0,
      checked: 0,
      total: 0,
    };
    cat.total += 1;
    if (status !== undefined) {
      cat.checked += 1;
      if (isBrokenStatus(status)) {
        brokenCount += 1;
        brokenHours += e.hours;
        brokenDevlogs += e.devlogs;
        cat.count += 1;
        cat.hours += e.hours;
        cat.devlogs += e.devlogs;
      }
    }
    brokenByType.set(e.type, cat);
    if (status !== undefined) {
      checkedCount += 1;
    }
  }
  const { queueEntries: _internalEntries, ...rest } = body;
  void _internalEntries;
  return {
    ...rest,
    queueCountExcludingBroken:
      checkedCount === 0 && rest.queueCount > 0
        ? null
        : rest.queueCount - brokenCount,
    brokenCount: checkedCount === 0 && rest.queueCount > 0 ? null : brokenCount,
    brokenCheckedCount: checkedCount,
    brokenTotalCount: rest.queueCount,
    brokenCheckComplete: checkedCount === rest.queueCount,
    pendingHoursExcludingBroken:
      checkedCount === 0 && rest.queueCount > 0
        ? null
        : rest.pendingHours - brokenHours,
    pendingDevlogsExcludingBroken:
      checkedCount === 0 && rest.queueCount > 0
        ? null
        : rest.pendingDevlogs - brokenDevlogs,
    categories: rest.categories.map((cat) => {
      const catBroken = brokenByType.get(cat.type) ?? {
        count: 0,
        hours: 0,
        devlogs: 0,
        checked: 0,
        total: cat.count,
      };
      const isComplete =
        catBroken.checked === catBroken.total && catBroken.total > 0;
      return {
        ...cat,
        countExcludingBroken:
          catBroken.checked === 0 && catBroken.total > 0
            ? null
            : cat.count - catBroken.count,
        brokenCount:
          catBroken.checked === 0 && catBroken.total > 0
            ? null
            : catBroken.count,
        brokenCheckedCount: catBroken.checked,
        brokenTotalCount: catBroken.total,
        brokenCheckComplete: isComplete,
        pendingHoursExcludingBroken:
          catBroken.checked === 0 && catBroken.total > 0
            ? null
            : cat.pendingHours - catBroken.hours,
        pendingDevlogsExcludingBroken:
          catBroken.checked === 0 && catBroken.total > 0
            ? null
            : cat.pendingDevlogs - catBroken.devlogs,
      };
    }),
  };
}
const refreshInFlight = new Set<number>();
let lastSeenCookie = "";
function normalizeCookie(cookie: string): string {
  if (!cookie) return "";
  return cookie.startsWith("_stardance_session_4=")
    ? cookie
    : `_stardance_session_4=${cookie}`;
}
function resolveJobCookie(override?: string): string {
  return (
    normalizeCookie(override ?? "") ||
    lastSeenCookie ||
    normalizeCookie(process.env["STARDANCE_AUTH_COOKIE"] ?? "")
  );
}
function getStaleReviewLinks(
  limit = MAX_CHECKS_PER_JOB,
): { reviewId: number; url: string }[] {
  try {
    const rows = getReviewLinkDb()
      .query<ReviewLinkStatus, [number]>(
        `SELECT review_id as reviewId, url, status, checked_at as checkedAt FROM review_link_status ORDER BY checked_at ASC LIMIT ?`,
      )
      .all(limit);
    const now = Date.now();
    const stale = rows.filter(
      (r) =>
        Number.isFinite(r.reviewId) &&
        r.reviewId > 0 &&
        !!r.url &&
        !refreshInFlight.has(r.reviewId) &&
        !isFresh(r.checkedAt, now),
    );
    return stale.map((r) => ({ reviewId: r.reviewId, url: r.url }));
  } catch {
    return [];
  }
}
async function probeAndCache(
  batch: { reviewId: number; url: string }[],
  cookie: string,
): Promise<void> {
  for (const item of batch) {
    refreshInFlight.add(item.reviewId);
  }
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
        if (status === 404 || status === 410) {
          const released = await Promise.all(
            settled.map(async ({ item, status }) => {
              if (status != null) {
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
              const ok = await releaseReviewClaim(item.reviewId, cookie);
              if (ok) {
                logger.info("Released claim for probed GOI review", {
                  reviewId: item.reviewId,
                  status,
                });
              } else {
                logger.warn("Failed releasing claim for probed GOI review", {
                  reviewId: item.reviewId,
                  status,
                });
              }
              return ok;
            }),
          );
          void released;
        }
      }
    }
  } catch (err) {
    logger.warn("Background GOI review link refresh failed", { error: err });
  } finally {
    for (const item of batch) {
      refreshInFlight.delete(item.reviewId);
    }
  }
}
let jobRunning = false;
export async function runGoiReviewCheckJob(
  overrideCookie?: string,
): Promise<number> {
  if (jobRunning) return 0;
  const cookie = resolveJobCookie(overrideCookie);
  if (!cookie) return 0;
  const batch = getStaleReviewLinks(MAX_CHECKS_PER_JOB);
  if (batch.length === 0) return 0;
  jobRunning = true;
  try {
    await probeAndCache(batch, cookie);
    return batch.length;
  } finally {
    jobRunning = false;
  }
}
export function refreshReviewLinksInBackground(
  entries: { reviewId: number; url: string }[],
  cookie: string,
): void {
  if (!cookie) return;
  lastSeenCookie = normalizeCookie(cookie);
  const toCheck: { reviewId: number; url: string }[] = [];
  const seen = new Set<number>();
  for (const e of entries) {
    if (!Number.isFinite(e.reviewId) || e.reviewId <= 0 || !e.url) {
      continue;
    }
    if (seen.has(e.reviewId) || refreshInFlight.has(e.reviewId)) {
      continue;
    }
    seen.add(e.reviewId);
    if (getCachedReviewStatus(e.reviewId)) {
      continue;
    }
    toCheck.push({ reviewId: e.reviewId, url: e.url });
  }
  const batch = toCheck.slice(0, MAX_CHECKS_PER_JOB);
  if (batch.length === 0) return;
  void probeAndCache(batch, lastSeenCookie);
}