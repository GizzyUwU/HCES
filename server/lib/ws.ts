import { db, logger } from "@server/index";
import Elysia, { type TSchema } from "elysia";
import { z } from "zod";
import { Compile } from "@sinclair/typemap";
import { createHash } from "crypto";
import {
  Channel,
  RpcError,
} from "ws-asyncapi";
import { apiKeys } from "@server/schema/apiKeys";
import { eq } from "drizzle-orm";
const intervals = new Map<string, ReturnType<typeof setInterval>>();
const pingTimeouts = new Map<string, ReturnType<typeof setInterval>>();

export function wsSchema<T extends TSchema>(schema: T) {
  return Object.assign({}, schema, Compile(schema)) as any;
}

function clearSubs(wsId: string) {
  for (const k of intervals.keys()) {
    if (k.startsWith(wsId)) {
      clearInterval(intervals.get(k));
      intervals.delete(k);
    }
  }
}

function pingTimeout(connId: string, onTimeout: () => void) {
  const existing = pingTimeouts.get(connId);
  if (existing) clearTimeout(existing);
  pingTimeouts.set(connId, setTimeout(onTimeout, 3 * 60 * 1000));
}

export function websocketHandler(app: Elysia) {
  const supportedPaths = app.routes
    .map((r) => r.path)
    .filter((p) => p.startsWith("/api/v1") && !p.startsWith("/api/v1/web"));

  if (supportedPaths.length === 0) {
    logger.error(
      "scraperChannel: no supported paths found — app.routes empty at build time",
    );
  }

  return new Channel("/ws", "wsAPI")
    .headers(
      z.object({
        authorization: z.string(),
      }),
    )
    .resolve(async ({ request }) => {
      const bearer = request.headers["authorization"].startsWith("Bearer ")
        ? request.headers["authorization"].slice(7)
        : undefined;
      if (!bearer) throw new RpcError("UNAUTHENTICATED", "missing api key");
      const hash = createHash("sha256").update(bearer).digest("hex");
      const [keyData] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hash));
      if (!keyData || Object.keys(keyData).length === 0)
        throw new RpcError("UNAUTHENTICATED", "invalid api key");
      db.update(apiKeys)
        .set({ lastUsed: new Date() })
        .where(eq(apiKeys.id, keyData.id))
        .catch((err) => logger.error("failed to update lastUsed", { err }));
      return {
        keyData: keyData,
      };
    })
    .onOpen(({ ws }) => {
      ws.subscribe(ws.id);
      pingTimeout(ws.id, () => {
        clearSubs(ws.id);
        ws.close();
      });
    })
    .onClose(({ ws }) => {
      clearSubs(ws.id);
      const t = pingTimeouts.get(ws.id);
      if (t) clearTimeout(t);
      pingTimeouts.delete(ws.id);
    })
    .serverMessage(
      "result",
      z.object({
        id: z.string(),
        status: z.number(),
        data: z.unknown().nullish(),
      }) as any,
    )
    .serverMessage(
      "cancelled",
      z.object({
        id: z.string(),
      }),
    )
    .serverMessage("_cheese", z.object({}))
    .clientMessage(
      "i_want_to",
      ({ ws }) => {
        pingTimeout(ws.id, () => {
          clearSubs(ws.id);
          ws.close();
        });
        ws.publish(ws.id, "_cheese", {});
      },
      z.object({}),
    )
    .clientMessage(
      "start",
      async ({ ws, message }) => {
        const key = ws.id + ":" + message.id;
        const run = async () => {
          const req = new Request("http://internal" + message.path, {
            headers: {
              ...(message.headers ?? {}),
              "x-hces-worker-internal": "1",
            },
          });
          const res = await app.handle(req);
          const data = await res.json().catch(() => null);
          ws.publish(ws.id, "result", {
            id: message.id,
            status: res.status,
            data,
          });
        };

        const existing = intervals.get(key);
        if (existing) clearInterval(existing);
        await run();
        if (message.intervalMs)
          intervals.set(key, setInterval(run, message.intervalMs));
        return;
      },
      z.object({
        id: z.string(),
        path: z.union(
          app.routes
            .map((r) => r.path)
            .filter(
              (p) => p.startsWith("/api/v1") && !p.includes("/api/v1/web"),
            )
            .map((p) => z.literal(p)),
        ),
        headers: z.record(z.string(), z.string()).optional(),
        intervalMs: z.number().optional(),
      }),
    )
    .clientMessage(
      "stop",
      ({ ws, message }) => {
        const key = ws.id + ":" + message.id;
        const existing = intervals.get(key);
        if (existing) clearInterval(existing);
        intervals.delete(key);
        ws.publish(ws.id, "cancelled", {
          id: message.id,
        });
        return;
      },
      z.object({
        id: z.string(),
      }),
    );
}
