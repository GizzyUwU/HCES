import Elysia from "elysia";
import { createHash } from "node:crypto";
import { registerWorker, unregisterWorker, resolveJob } from "./workerPool";
import { db, logger } from "@server/index";
import { workers } from "@server/schema/workers";
import { APIError } from "../error";
import bearer from "@elysia/bearer";
import { eq } from "drizzle-orm";

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
  .ws("/ws/workers", {
    open(ws) {
      const { id, label } = ws.data.worker;
      registerWorker(id, (data) => ws.send(data));
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

    message(_, message) {
      let msg: {
        type: string;
        id: string;
        status: number;
        data: unknown;
        bytes: number;
      };
      try {
        msg = typeof message === "string" ? JSON.parse(message) : (message as typeof msg);
      } catch {
        return;
      }
      if (msg.type !== "result") return;
      resolveJob(msg.id, {
        status: msg.status,
        data: msg.data,
        bytes: msg.bytes
      })
    },
    close(ws) {
      unregisterWorker(ws.data.worker.id);
    },
  });
