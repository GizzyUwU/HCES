import Elysia from "elysia";
import { createHash } from "node:crypto";
import { registerWorker, unregisterWorker, resolveJob } from "./workerPool";
import { db, logger } from "@server/lib/utils";
import { workers } from "@server/schema/workers";
import { APIError } from "@server/lib/error";
import bearer from "@elysia/bearer";
import { eq } from "drizzle-orm";
const lastCheese = new Map<string, number>();
const iWantToTimers = new Map<string, ReturnType<typeof setInterval>>();
const sockets = new Map<string, { close: () => void }>();

function markDead(id: string) {
  const timer = iWantToTimers.get(id);
  if (timer) clearInterval(timer);
  iWantToTimers.delete(id);
  lastCheese.delete(id);
  unregisterWorker(id);
  const socket = sockets.get(id);
  sockets.delete(id);
  try {
    socket?.close();
  } catch {}
}

setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of lastCheese) {
    if (now - ts > 45 * 1000) {
      logger.warn("worker missed the i want to's so killin it", { id });
      markDead(id);
    }
  }
}, 15 * 1000);

export const workerChannel = new Elysia({
  name: "workerChannel",
})
  .use(bearer())
  .resolve(async ({ headers, bearer }) => {
    if (!bearer)
      throw new APIError({
        status: 401,
        msg: "unauthorized",
      });
    const hash = createHash("sha256").update(bearer).digest("hex");
    const [worker] = await db
      .select()
      .from(workers)
      .where(eq(workers.keyHash, hash));
    if (!worker)
      throw new APIError({
        status: 401,
        msg: "unauthorized",
      });

    return { worker, workerVersion: headers["x-worker-version"] };
  })
  .ws("/api/workers", {
    open(ws) {
      const { id, label } = ws.data.worker;
      registerWorker(id, (data) => ws.send(data));
      sockets.set(id, ws);

      lastCheese.set(id, Date.now());
      iWantToTimers.set(
        id,
        setInterval(
          () => ws.send(JSON.stringify({ type: "i_want_to" })),
          15 * 1000,
        ),
      );
      db.update(workers)
        .set({
          lastConnectedAt: new Date(),
          connected: true,
          versionSHA: ws.data.workerVersion ?? null,
        })
        .where(eq(workers.id, id))
        .catch((err) =>
          logger.error("failed to update worker with connection info", { err }),
        );
      logger.info(`${label} worker connected`, {
        id,
        label,
        version: ws.data.workerVersion,
      });
    },

    message(ws, message) {
      let msg: {
        type: string;
        id: string;
        status: number;
        data: unknown;
        bytes: number;
        headers?: Record<string, string>;
      };
      try {
        msg =
          typeof message === "string"
            ? JSON.parse(message)
            : (message as typeof msg);
      } catch {
        return;
      }
      if (msg.type === "_cheese") {
        lastCheese.set(ws.data.worker.id, Date.now());
        return;
      }
      if (msg.type !== "result") return;
      resolveJob(msg.id, {
        status: msg.status,
        data: msg.data,
        bytes: msg.bytes,
         headers: msg.headers,
      });
    },
    close(ws) {
      unregisterWorker(ws.data.worker.id);
    },
  });
