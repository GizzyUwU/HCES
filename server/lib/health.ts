import { sql } from "drizzle-orm";
import { db } from "@server/lib/db";
import { workers } from "@server/schema/workers";
import { getConnectedCount, getPendingCount, getConnectedIds } from "@server/lib/worker/workerPool";
import { getStaleWorkerIds } from "@server/lib/worker/workerChannel";
import { logger } from "@server/lib/logger";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function shallowHealth() {
  return {
    ok: true,
    status: "healthy" as const,
    mode: "orchestrator" as const,
    version: process.env["GIT_COMMIT_SHA"] || "unknown",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export async function deepHealth() {
  const expectedMin = envInt("HEALTH_MIN_WORKERS", 1);
  const maxPending = envInt("HEALTH_MAX_PENDING", 100);
  const version = process.env["GIT_COMMIT_SHA"] || "unknown";
  const uptime = Math.floor(process.uptime());
  const timestamp = new Date().toISOString();

  let dbOk = false;

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("db_timeout")), 2000)
    );
    await Promise.race([db.execute(sql`select 1 as ok`), timeout]);
    dbOk = true;
  } catch (e) {
    logger.error("health db check failed", { error: e });
    dbOk = false;
  }

  let connected = 0;
  let pendingJobs = 0;
  let stale = 0;
  let versionMismatchCount = 0;

  try {
    connected = getConnectedCount();
    pendingJobs = getPendingCount();
    stale = getStaleWorkerIds().length;
  } catch {
    connected = 0;
    pendingJobs = 0;
    stale = 0;
  }

  try {
    const rows = await db
      .select({
        id: workers.id,
        connected: workers.connected,
        versionSHA: workers.versionSHA,
      })
      .from(workers);

    const inMem = new Set(getConnectedIds());

    for (const r of rows) {
      if (
        r.connected &&
        r.versionSHA != null &&
        version !== "unknown" &&
        r.versionSHA !== version
      ) {
        versionMismatchCount++;
      }
      if (r.connected && !inMem.has(r.id)) {
        stale = Math.max(stale, 1);
      }
    }
  } catch (e) {
    logger.error("health workers check failed", { error: e });
  }

  let status: "healthy" | "degraded" | "unhealthy" = "healthy";

  if (!dbOk) {
    status = "unhealthy";
  } else if (connected === 0) {
    status = "unhealthy";
  } else if (
    stale > 0 ||
    versionMismatchCount > 0 ||
    connected < expectedMin ||
    pendingJobs > maxPending
  ) {
    status = "degraded";
  }

  const workersOk = status === "healthy";

  return {
    ok: status === "healthy",
    status,
    mode: "orchestrator" as const,
    uptime,
    timestamp,
    checks: {
      db: {
        ok: dbOk,
      },
      workers: {
        ok: workersOk,
        connected,
        expectedMin,
      },
    },
  };
}
