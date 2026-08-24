import { createId } from "@paralleldrive/cuid2";
import { db, logger, opClient } from "@server/index";
import { workerStats } from "@server/schema/workerStats";
import { eq } from "drizzle-orm";
import { workers as workersSchema } from "@server/schema/workers";
import { createHash } from "node:crypto";
import {
  handleJob,
  type HandleJobResult,
  type JobMessage,
} from "./workerRuntime";
const workers = new Map<
  string,
  {
    id: string;
    send: (data: string) => void;
  }
>();
const pending = new Map<
  string,
  {
    resolve: (result: {
      status: number;
      data: unknown;
      bytes: number;
      headers?: Record<string, string>;
    }) => void;
    reject: (err: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

const localWorkerStats = new Map<
  string,
  Map<
    string,
    {
      hits: number[];
      latencies: {
        at: number;
        ms: number;
      }[];
    }
  >
>();

function getStat(
  scraper: string,
  workerId: string,
): {
  hits: number[];
  latencies: {
    at: number;
    ms: number;
  }[];
} {
  let byWorker = localWorkerStats.get(scraper);
  if (!byWorker) localWorkerStats.set(scraper, (byWorker = new Map()));
  let s = byWorker.get(workerId);
  if (!s) byWorker.set(workerId, (s = { hits: [], latencies: [] }));
  return s;
}

function prune(
  s: {
    hits: number[];
    latencies: {
      at: number;
      ms: number;
    }[];
  },
  now: number,
): void {
  s.hits = s.hits.filter((t) => t > now - 60 * 1000);
  s.latencies = s.latencies.filter((l) => l.at > now - 300 * 1000);
  return;
}

let localWorker = "";
export async function enableLocalWorker(key: string, versionSHA: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  const local = await db
    .update(workersSchema)
    .set({
      connected: true,
      lastConnectedAt: new Date(),
      versionSHA,
    })
    .where(eq(workersSchema.keyHash, hash))
    .returning({ id: workersSchema.id })
    .catch((err) => {
      logger.error("failed to update local worker with connection info", {
        err,
      });
      return [] as { id: string }[];
    });
  if (!local[0]) {
    logger.warn("Failed finding local worker's key id so disabling it");
    return;
  }
  localWorker = local[0].id;
  logger.info("Local worker enabled");

  registerWorker(localWorker, (data) => {
    const msg = JSON.parse(data) as JobMessage;
    if (msg.type !== "job") return;
    void handleJob(msg, (data) => {
      const result = JSON.parse(data) as HandleJobResult;
      resolveJob(result.id, {
        status: result.status,
        data: result.data,
        bytes: result.bytes ?? 0,
        headers: result.headers,
      });
    });
  });
}

export function isLocalWorker(id: string): boolean {
  return localWorker.length > 0 && id === localWorker;
}

function candidateIds(): string[] {
  const ids = Array.from(workers.keys());
  if (localWorker.length > 0) {
    ids.push(localWorker);
  }
  return ids;
}

export function registerWorker(id: string, send: (data: string) => void) {
  workers.set(id, { id, send });
  if (id !== localWorker) {
    logger.info("Worker connected", {
      id,
      poolSize: workers.size,
    });
  }
  return;
}

export function unregisterWorker(id: string) {
  workers.delete(id);
  db.update(workersSchema)
    .set({
      connected: false,
    })
    .where(eq(workersSchema.id, id))
    .catch((err) =>
      logger.error("failed to update worker with connection info", { err }),
    );
  logger.info("worker disconnected", {
    id,
    poolSize: workers.size,
  });
}

function scraperNameFromPath(path: string): string {
  const paths = path.split("/").filter(Boolean);
  return paths[2] ?? path;
}

export async function pickWorker(path: string): Promise<{ scraper: string; workerId: string | null } | null> {
  const candidates = candidateIds();
  if (candidates.length === 0) return null;
  const scraper = scraperNameFromPath(path);
  const now = Date.now();
  let best: string | null = null,
    bestHits = Infinity,
    bestLatency = Infinity;
  for (const id of candidates) {
    const s = getStat(scraper, id);
    prune(s, now);
    const hits = s.hits.length;
    const latency = s.latencies.length;
    if (hits < bestHits || (hits === bestHits && latency < bestLatency))
      ((best = id), (bestHits = hits), (bestLatency = latency));
  }

  if (best) getStat(scraper, best).hits.push(now);
  return { scraper, workerId: best };
}

const pendingDispatches = new Map<string, Promise<unknown>>();

export function recordDispatch(workerId: string, path: string): string {
  const id = createId();
  const insert = db
    .insert(workerStats)
    .values({
      id,
      workerId: workerId,
      scraper: scraperNameFromPath(path),
    })
    .catch((err) => {
      logger.error("failed to record dispatch", { err });
    })
    .finally(() => {
      pendingDispatches.delete(id);
    });
  pendingDispatches.set(id, insert);
  return id;
}

export async function recordCompletion(
  scraper: string,
  path: string,
  rowId: string,
  latencyMs: number,
  bytes: number,
): Promise<void> {
  await pendingDispatches.get(rowId);
  getStat(scraper, rowId).latencies.push({ at: Date.now(), ms: latencyMs });
  if (opClient) {
    opClient.identify({
      profileId: rowId,
      properties: {
        bytes,
        scraper,
        path,
        latencyMs,
        dev: process.env["DEV"] ?? false,
      },
    });

    await opClient.track("workers");
    opClient.clear();
  }
}

export async function resetStaleConnections(): Promise<void> {
  const rows = await db
    .update(workersSchema)
    .set({ connected: false })
    .where(eq(workersSchema.connected, true))
    .returning({ id: workersSchema.id });
  if (rows.length > 0) {
    logger.info("Wiped out stale worker connections", {
      count: rows.length,
    });
  }
}

export function sendToWorker(
  workerId: string,
  path: string,
  headers: Record<string, string>,
): Promise<{
  status: number;
  data: unknown;
  bytes: number;
  headers?: Record<string, string>;
}> {
  const worker = workers.get(workerId);
  if (!worker) return Promise.reject(new Error("worker_not_connected"));
  const id = createId();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error("worker_timeout"));
    }, 15 * 1000);
    pending.set(id, {
      resolve,
      reject,
      timeout,
    });
    worker.send(
      JSON.stringify({
        type: "job",
        id,
        path,
        headers: {
          ...headers,
          "x-hces-worker-internal": "1",
        },
      }),
    );
  });
}

export function resolveJob(
  id: string,
  result: {
    status: number;
    data: unknown;
    bytes: number;
    headers?: Record<string, string>;
  },
) {
  const job = pending.get(id);
  if (!job) return;
  clearTimeout(job.timeout);
  pending.delete(id);
  job.resolve(result);
}
