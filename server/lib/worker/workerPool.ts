import { createId } from "@paralleldrive/cuid2";
import { db, logger } from "@server/lib/utils";
import prometheusRegistry from "@server/lib/metrics";
import { workerStats } from "@server/schema/workerStats";
import { eq } from "drizzle-orm";
import { workers as workersSchema } from "@server/schema/workers";
import { createHash } from "node:crypto";
import {
  handleJob,
  type HandleJobResult,
  type JobMessage,
} from "./workerRuntime";
import { Counter, Gauge, Histogram } from "prom-client";
const workerCompletions = new Counter({
  name: "worker_completions_total",
  help: "Total num of completed jobs",
  labelNames: ["scraper", "path", "worker_id", "dev"],
  registers: [prometheusRegistry],
});

const workerBytes = new Counter({
  name: "worker_bytes_total",
  help: "Total num of bytes returned by workers",
  labelNames: ["scraper", "path", "worker_id", "dev"],
  registers: [prometheusRegistry],
});

const workerLatency = new Histogram({
  name: "worker_latency_seconds",
  help: "Worker latency in seconds",
  labelNames: ["scraper", "path", "worker_id", "dev"],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15],
  registers: [prometheusRegistry],
});

const workerDispatches = new Counter({
  name: "worker_dispatches_total",
  help: "Total num of bytes returned by workers",
  labelNames: ["scraper", "path", "worker_id", "dev"],
  registers: [prometheusRegistry],
});

const workerErrors = new Counter({
  name: "worker_errors_total",
  help: "Total num of worker errors",
  labelNames: ["worker_id", "error", "dev"],
  registers: [prometheusRegistry],
});

const connectedWorkers = new Gauge({
  name: "workers_connected",
  help: "Num of connected workers atm",
});

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
    console.log("aaa")
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
  connectedWorkers.set(workers.size);
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
  connectedWorkers.set(workers.size);
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

export async function pickWorker(
  path: string,
): Promise<{ scraper: string; workerId: string | null } | null> {
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
    const latency = s.latencies.length
      ? s.latencies.reduce((sum, l) => sum + l.ms, 0) / s.latencies.length
      : 0;
    if (hits < bestHits || (hits === bestHits && latency < bestLatency))
      ((best = id), (bestHits = hits), (bestLatency = latency));
  }

  if (best) getStat(scraper, best).hits.push(now);
  return { scraper, workerId: best };
}

const pendingDispatches = new Map<string, Promise<unknown>>();

export function recordDispatch(workerId: string, path: string): string {
  const id = createId();
  const scraper = scraperNameFromPath(path);
  workerDispatches.inc({
    scraper,
    path,
    worker_id: workerId,
    dev: String(process.env["DEV"] ?? false),
  });
  const insert = db
    .insert(workerStats)
    .values({
      id,
      workerId: workerId,
      scraper,
    })
    .catch((err) => {
      workerErrors.inc({
        worker_id: workerId,
        error: "db_insert",
        dev: String(process.env["DEV"] ?? false),
      });
      logger.error("failed to record dispatch", { err });
    })
    .finally(() => {
      pendingDispatches.delete(id);
    });
  pendingDispatches.set(id, insert);
  return workerId;
}

export async function recordCompletion(
  scraper: string,
  path: string,
  workerId: string,
  rowId: string,
  latencyMs: number,
  bytes: number,
): Promise<void> {
  await pendingDispatches.get(rowId);
  getStat(scraper, workerId).latencies.push({ at: Date.now(), ms: latencyMs });
  const labels = {
    scraper,
    worker_id: workerId,
    path,
    dev: process.env["DEV"] ?? "false",
  };
  workerCompletions.inc(labels);
  workerBytes.inc(labels, bytes);
  workerLatency.observe(labels, latencyMs / 1000);
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

  connectedWorkers.set(workers.size);
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
  if (!worker) {
    workerErrors.inc({
      worker_id: workerId,
      error: "worker_not_connected",
      dev: String(process.env["DEV"] ?? false),
    });
    return Promise.reject(new Error("worker_not_connected"));
  }
  const id = createId();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      workerErrors.inc({
        worker_id: workerId,
        error: "worker_timeout",
        dev: String(process.env["DEV"] ?? false),
      });
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
        workerId,
        path,
        headers: {
          ...headers,
          "x-hces-worker-internal": "1",
          "x-hces-worker-id": workerId,
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
