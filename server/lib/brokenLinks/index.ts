import { asc, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "@server/lib/logger";
import { brokenLinksDbPath, getBrokenLinksDb } from "./db";
import { brokenProjectLinks } from "./schema";

export const BROKEN_LINK_TTL_MS = 2 * 24 * 60 * 60 * 1000;
export const MAX_CHECKS_PER_JOB = 60;
const PROBE_CONCURRENCY = 5;
const STARDANCE_BASE_URL = "https://stardance.hackclub.com";

let lastJobAt: number | null = null;
let lastJobChecked = 0;
let lastJobBroken = 0;
let lastJobSkipped: string | null = null;
let lastDiscoveryAt: number | null = null;
let lastDiscoveryCount = 0;

export type ProjectLinkEntry = {
  projectId: number;
  url: string;
  type: string;
  hours: number;
  devlogs: number;
};

export function normalizeProjectLink(
  href: string | undefined | null,
): { projectId: number; url: string } | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  const withoutAdmin = trimmed.replace(/^\/admin(?=\/)/, "");
  const match = withoutAdmin.match(/^\/projects\/(\d+)(?:[/?#]|$)/);
  if (!match) return null;
  const projectId = Number(match[1]);
  if (!Number.isFinite(projectId)) return null;
  return { projectId, url: `/projects/${projectId}` };
}

export function isBrokenStatus(status: number): boolean {
  return status === 404;
}

export function isFresh(
  checkedAt: number | null | undefined,
  now = Date.now(),
): boolean {
  if (checkedAt == null) return false;
  return now - checkedAt < BROKEN_LINK_TTL_MS;
}

export function rememberProjectLinks(entries: ProjectLinkEntry[]): void {
  lastDiscoveryAt = Date.now();
  lastDiscoveryCount = entries.length;
  if (entries.length === 0) return;
  const seen = new Set<string>();
  const rows: { url: string; projectId: number; category: string }[] = [];
  for (const e of entries) {
    if (seen.has(e.url)) continue;
    seen.add(e.url);
    rows.push({ url: e.url, projectId: e.projectId, category: e.type });
  }
  if (rows.length === 0) return;
  try {
    getBrokenLinksDb()
      .insert(brokenProjectLinks)
      .values(rows)
      .onConflictDoUpdate({
        target: brokenProjectLinks.url,
        set: {
          projectId: sql`excluded.project_id`,
          category: sql`excluded.category`,
        },
      })
      .run();
  } catch (err) {
    logger.warn(`Failed remembering GOI project links: ${String(err)}`, { error: err });
  }
}

function getCachedLinkStatuses(
  urls: string[],
): Map<string, { status: number | null; checkedAt: number | null }> {
  const map = new Map<
    string,
    { status: number | null; checkedAt: number | null }
  >();
  if (urls.length === 0) return map;
  try {
    const db = getBrokenLinksDb();
    for (let i = 0; i < urls.length; i += 200) {
      const chunk = urls.slice(i, i + 200);
      const rows = db
        .select({
          url: brokenProjectLinks.url,
          status: brokenProjectLinks.status,
          checkedAt: brokenProjectLinks.checkedAt,
        })
        .from(brokenProjectLinks)
        .where(inArray(brokenProjectLinks.url, chunk))
        .all();
      for (const r of rows) {
        map.set(r.url, { status: r.status, checkedAt: r.checkedAt });
      }
    }
  } catch (err) {
    logger.warn(`Failed reading broken link cache: ${String(err)}`, { error: err });
  }
  return map;
}

export type BrokenLinkCounts = {
  total: number;
  checked: number;
  brokenHours: number;
  brokenDevlogs: number;
  brokenUrls: Set<string>;
  byCategory: Map<
    string,
    { broken: number; checked: number; brokenHours: number; brokenDevlogs: number }
  >;
};

export function countBrokenLinks(
  entries: ProjectLinkEntry[],
): BrokenLinkCounts {
  const byCategory = new Map<
    string,
    { broken: number; checked: number; brokenHours: number; brokenDevlogs: number }
  >();
  const brokenUrls = new Set<string>();
  let total = 0;
  let checked = 0;
  let brokenHours = 0;
  let brokenDevlogs = 0;
  if (entries.length === 0)
    return { total, checked, brokenHours, brokenDevlogs, brokenUrls, byCategory };
  const cached = getCachedLinkStatuses([
    ...new Set(entries.map((e) => e.url)),
  ]);
  for (const e of entries) {
    const hit = cached.get(e.url);
    const stats = byCategory.get(e.type) ?? {
      broken: 0,
      checked: 0,
      brokenHours: 0,
      brokenDevlogs: 0,
    };
    if (hit && hit.status != null) {
      stats.checked += 1;
      checked += 1;
      if (isBrokenStatus(hit.status)) {
        stats.broken += 1;
        stats.brokenHours += e.hours;
        stats.brokenDevlogs += e.devlogs;
        total += 1;
        brokenHours += e.hours;
        brokenDevlogs += e.devlogs;
        brokenUrls.add(e.url);
      }
    }
    byCategory.set(e.type, stats);
  }
  return { total, checked, brokenHours, brokenDevlogs, brokenUrls, byCategory };
}

export type DatedProjectLink = {
  url: string;
  type: string;
  date: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseQueueAge(
  ageText: string,
  now = Date.now(),
): Date | null {
  const normalized = ageText.trim().toLowerCase();
  if (normalized === "today") return new Date(now);
  if (normalized === "yesterday") return new Date(now - DAY_MS);
  const ageMatch = ageText.match(
    /(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i,
  );
  if (!ageMatch) return null;
  const amount = Number(ageMatch[1]);
  const unit = ageMatch[2]?.toLowerCase();
  const ageMs =
    unit === "minute"
      ? amount * 60 * 1000
      : unit === "hour"
        ? amount * 60 * 60 * 1000
        : unit === "day"
          ? amount * DAY_MS
          : unit === "week"
            ? amount * 7 * DAY_MS
            : unit === "month"
              ? amount * 30 * DAY_MS
              : amount * 365 * DAY_MS;
  return new Date(now - ageMs);
}

export function selectOldestUnbroken(
  rows: DatedProjectLink[],
  brokenUrls: Set<string>,
): { oldest: Date | null; byCategory: Map<string, Date> } {
  let oldest: Date | null = null;
  const byCategory = new Map<string, Date>();
  for (const r of rows) {
    if (brokenUrls.has(r.url)) continue;
    if (oldest == null || r.date < oldest) oldest = r.date;
    const cur = byCategory.get(r.type);
    if (cur == null || r.date < cur) byCategory.set(r.type, r.date);
  }
  return { oldest, byCategory };
}

async function probeProjectStatus(
  url: string,
  cookie: string,
): Promise<number | null> {
  try {
    const res = await fetch(STARDANCE_BASE_URL + url, {
      headers: cookie ? { Cookie: cookie } : {},
      signal: AbortSignal.timeout(15 * 1000),
    });
    const status = res.status;
    try {
      await res.body?.cancel();
    } catch {}
    return status;
  } catch (err) {
    logger.warn(`Failed probing GOI project link ${url}: ${String(err)}`, { url, error: err });
    return null;
  }
}

function setCachedStatus(
  url: string,
  projectId: number,
  status: number,
  checkedAt: number,
): void {
  try {
    getBrokenLinksDb()
      .insert(brokenProjectLinks)
      .values({ url, projectId, status, checkedAt })
      .onConflictDoUpdate({
        target: brokenProjectLinks.url,
        set: { projectId, status, checkedAt },
      })
      .run();
  } catch (err) {
    logger.warn(`Failed caching GOI project link status ${url}: ${String(err)}`, { url, error: err });
  }
}

const refreshInFlight = new Set<string>();
let jobRunning = false;
let lastSeenCookie = "";

function normalizeCookie(cookie: string): string {
  if (!cookie) return "";
  return cookie.startsWith("_stardance_session_4=")
    ? cookie
    : `_stardance_session_4=${cookie}`;
}

export function noteBrokenLinkCookie(cookie: string): void {
  if (cookie) lastSeenCookie = normalizeCookie(cookie);
}

function resolveJobCookie(override?: string): string {
  return (
    normalizeCookie(override ?? "") ||
    lastSeenCookie ||
    normalizeCookie(process.env["STARDANCE_AUTH_COOKIE"] ?? "")
  );
}

export function getDueLinks(
  limit = MAX_CHECKS_PER_JOB,
): { url: string; projectId: number | null }[] {
  try {
    const cutoff = Date.now() - BROKEN_LINK_TTL_MS;
    const rows = getBrokenLinksDb()
      .select({
        url: brokenProjectLinks.url,
        projectId: brokenProjectLinks.projectId,
      })
      .from(brokenProjectLinks)
      .where(
        or(
          isNull(brokenProjectLinks.checkedAt),
          lt(brokenProjectLinks.checkedAt, cutoff),
        ),
      )
      .orderBy(asc(brokenProjectLinks.checkedAt))
      .limit(limit)
      .all();
    return rows.filter((r) => !!r.url && !refreshInFlight.has(r.url));
  } catch (err) {
    logger.warn(`Failed loading due GOI project links: ${String(err)}`, { error: err });
    return [];
  }
}

async function probeAndCache(
  batch: { url: string; projectId: number | null }[],
  cookie: string,
): Promise<{ checked: number; broken: number }> {
  const result = { checked: 0, broken: 0 };
  for (const item of batch) {
    refreshInFlight.add(item.url);
  }
  try {
    for (let i = 0; i < batch.length; i += PROBE_CONCURRENCY) {
      const chunk = batch.slice(i, i + PROBE_CONCURRENCY);
      const settled = await Promise.all(
        chunk.map(async (item) => ({
          item,
          status: await probeProjectStatus(item.url, cookie),
        })),
      );
      const at = Date.now();
      for (const { item, status } of settled) {
        if (status != null && item.projectId != null) {
          setCachedStatus(item.url, item.projectId, status, at);
          result.checked += 1;
          if (isBrokenStatus(status)) result.broken += 1;
        }
      }
    }
  } catch (err) {
    logger.warn(`Background GOI project link refresh failed: ${String(err)}`, { error: err });
  } finally {
    for (const item of batch) {
      refreshInFlight.delete(item.url);
    }
  }
  return result;
}

export async function runBrokenLinkCheckJob(
  overrideCookie?: string,
): Promise<number> {
  if (jobRunning) {
    lastJobSkipped = "already_running";
    return 0;
  }
  const cookie = resolveJobCookie(overrideCookie);
  if (!cookie) {
    lastJobAt = Date.now();
    lastJobSkipped = "no_cookie";
    const state = getBrokenLinkDebugState();
    logger.info(
      `GOI broken link check skipped, no stardance cookie seen yet (${formatDebugState(state)})`,
      state,
    );
    return 0;
  }
  const batch = getDueLinks(MAX_CHECKS_PER_JOB);
  if (batch.length === 0) {
    lastJobAt = Date.now();
    lastJobChecked = 0;
    lastJobBroken = 0;
    lastJobSkipped = null;
    const state = getBrokenLinkDebugState();
    logger.info(
      `GOI broken link check job ran, nothing due (${formatDebugState(state)})`,
      state,
    );
    return 0;
  }
  jobRunning = true;
  try {
    const result = await probeAndCache(batch, cookie);
    lastJobAt = Date.now();
    lastJobChecked = result.checked;
    lastJobBroken = result.broken;
    lastJobSkipped = null;
    const state = getBrokenLinkDebugState();
    logger.info(
      `GOI broken link check job ran (${formatDebugState(state)})`,
      state,
    );
    return batch.length;
  } finally {
    jobRunning = false;
  }
}

export function brokenCountOrNull(
  count: number,
  broken: number,
  checked: number,
): number | null {
  if (count > 0 && checked === 0) return null;
  return broken;
}

export function refreshBrokenLinksInBackground(
  entries: ProjectLinkEntry[],
  cookie: string,
): void {
  noteBrokenLinkCookie(cookie);
  rememberProjectLinks(entries);
  const resolved = resolveJobCookie(cookie);
  if (!resolved) return;
  const now = Date.now();
  const cached = getCachedLinkStatuses([
    ...new Set(entries.map((e) => e.url)),
  ]);
  const seen = new Set<string>();
  const toCheck: { url: string; projectId: number | null }[] = [];
  for (const e of entries) {
    if (seen.has(e.url) || refreshInFlight.has(e.url)) continue;
    seen.add(e.url);
    const hit = cached.get(e.url);
    if (hit && isFresh(hit.checkedAt, now)) continue;
    toCheck.push({ url: e.url, projectId: e.projectId });
  }
  const batch = toCheck.slice(0, MAX_CHECKS_PER_JOB);
  if (batch.length === 0) return;
  logger.info(
    `GOI broken link background refresh started for ${batch.length} links`,
  );
  void probeAndCache(batch, resolved).then((result) => {
    logger.info(
      `GOI broken link background refresh finished, checked ${result.checked}, broken ${result.broken}`,
    );
  });
}

export type BrokenLinkDebugState = {
  dbPath: string;
  linksTotal: number;
  linksChecked: number;
  linksBroken: number;
  linksDue: number;
  oldestCheckedAt: string | null;
  newestCheckedAt: string | null;
  hasCookie: boolean;
  lastDiscoveryAt: string | null;
  lastDiscoveryCount: number;
  lastJobAt: string | null;
  lastJobChecked: number;
  lastJobBroken: number;
  lastJobSkipped: string | null;
  checkIntervalMinutes: number;
  ttlDays: number;
};

export function formatDebugState(state: BrokenLinkDebugState): string {
  return (
    `db=${state.dbPath} total=${state.linksTotal} ` +
    `checked=${state.linksChecked} broken=${state.linksBroken} ` +
    `due=${state.linksDue} cookie=${state.hasCookie ? "yes" : "no"} ` +
    `discovered=${state.lastDiscoveryCount} ` +
    `jobChecked=${state.lastJobChecked} jobBroken=${state.lastJobBroken} ` +
    `skipped=${state.lastJobSkipped ?? "no"}`
  );
}

export function getBrokenLinkDebugState(): BrokenLinkDebugState {  let linksTotal = 0;
  let linksChecked = 0;
  let linksBroken = 0;
  let oldestCheckedAt: string | null = null;
  let newestCheckedAt: string | null = null;
  try {
    const rows = getBrokenLinksDb()
      .select({
        status: brokenProjectLinks.status,
        checkedAt: brokenProjectLinks.checkedAt,
      })
      .from(brokenProjectLinks)
      .all();
    linksTotal = rows.length;
    let oldest: number | null = null;
    let newest: number | null = null;
    for (const r of rows) {
      if (r.status != null) {
        linksChecked += 1;
        if (isBrokenStatus(r.status)) linksBroken += 1;
      }
      if (r.checkedAt != null) {
        if (oldest == null || r.checkedAt < oldest) oldest = r.checkedAt;
        if (newest == null || r.checkedAt > newest) newest = r.checkedAt;
      }
    }
    if (oldest != null) oldestCheckedAt = new Date(oldest).toISOString();
    if (newest != null) newestCheckedAt = new Date(newest).toISOString();
  } catch (err) {
    logger.warn(`Failed reading broken link debug state: ${String(err)}`, { error: err });
  }
  return {
    dbPath: brokenLinksDbPath(),
    linksTotal,
    linksChecked,
    linksBroken,
    linksDue: getDueLinks(MAX_CHECKS_PER_JOB).length,
    oldestCheckedAt,
    newestCheckedAt,
    hasCookie: resolveJobCookie() !== "",
    lastDiscoveryAt:
      lastDiscoveryAt != null ? new Date(lastDiscoveryAt).toISOString() : null,
    lastDiscoveryCount,
    lastJobAt: lastJobAt != null ? new Date(lastJobAt).toISOString() : null,
    lastJobChecked,
    lastJobBroken,
    lastJobSkipped,
    checkIntervalMinutes: 5,
    ttlDays: 2,
  };
}
