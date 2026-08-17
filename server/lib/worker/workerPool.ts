import { createId } from "@paralleldrive/cuid2";
import { db, logger } from "@server/index";
import { workerStats } from "@server/schema/workerStats";
import { and, avg, count, eq, gte, isNotNull } from "drizzle-orm";
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

let localWorker = "";
export async function enableLocalWorker(key: string, versionSHA: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  const local = await db
    .update(workersSchema)
    .set({
      connected: true,
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
  logger.info("Worker connected", {
    id,
    poolSize: workers.size,
  });
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

export async function pickWorker(path: string): Promise<string | null> {
  const candidates = candidateIds();
  if (candidates.length === 0) return null;

  const now = Date.now();
  const rateWindowStart = new Date(now - 60 * 1000);
  const latencyWindowStart = new Date(now - 5 * 60 * 1000);
  const [hitRows, latencyRows] = await Promise.all([
    db
      .select({
        workerId: workerStats.workerId,
        hits: count(),
      })
      .from(workerStats)
      .where(
        and(
          eq(workerStats.path, path),
          gte(workerStats.lastHit, rateWindowStart),
        ),
      )
      .groupBy(workerStats.workerId),
    db
      .select({
        workerId: workerStats.workerId,
        avgLatency: avg(workerStats.latencyMs),
      })
      .from(workerStats)
      .where(
        and(
          eq(workerStats.path, path),
          gte(workerStats.lastHit, latencyWindowStart),
          isNotNull(workerStats.latencyMs),
        ),
      )
      .groupBy(workerStats.workerId),
  ]);

  const hitsByWorker = new Map(
    hitRows.map((row) => [row.workerId, Number(row.hits)]),
  );
  const latencyByWorker = new Map(
    latencyRows.map((row) => [row.workerId, Number(row.avgLatency ?? 0)]),
  );
  let best: string | null = null,
    bestHits = Infinity,
    bestLatency = Infinity;
  for (const id of candidates) {
    const hits = hitsByWorker.get(id) ?? 0;
    const latency = latencyByWorker.get(id) ?? 0;
    if (hits < bestHits || (hits === bestHits && latency < bestLatency))
      ((best = id), (bestHits = hits), (bestLatency = latency));
  }

  return best;
}

export async function recordDispatch(
  workerId: string,
  path: string,
): Promise<string> {
  const [logged] = await db
    .insert(workerStats)
    .values({
      workerId: workerId,
      path,
    })
    .returning({ id: workerStats.id });
  if (!logged) throw new Error("failed_to_log_request");
  return logged.id;
}

export async function recordCompletion(
  rowId: string,
  latencyMs: number,
  bytes: number,
): Promise<void> {
  db.update(workerStats)
    .set({
      latencyMs,
      bytes,
    })
    .where(eq(workerStats.id, rowId))
    .catch((err) => logger.error("failed to record worker latency", { err }));
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
