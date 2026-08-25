import { logger } from "@server/index";
import Elysia from "elysia";
import { z } from "zod";
import { createHash } from "crypto";
import { Channel } from "ws-asyncapi";
import { APIError } from "./error";
import { getApiKey } from "./apiKeyCache";
const intervals = new Map<string, ReturnType<typeof setInterval>>();
const pingTimeouts = new Map<string, ReturnType<typeof setInterval>>();

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

  const routePatterns = supportedPaths.map((pattern) => ({
    pattern,
    regex: new RegExp(
      "^" + pattern.replace(/:[^/]+/g, "[^/]+").replace(/\//g, "\\/") + "$",
    ),
  }));

  return new Channel("/api/v1/ws", "wsAPI")
    .headers(
      z.object({
        authorization: z.string(),
      }),
    )
    .beforeUpgrade(async ({ headers }) => {
      const bearer = headers["authorization"].startsWith("Bearer ")
        ? headers["authorization"].slice(7)
        : undefined;
      if (!bearer)
        throw new APIError({
          status: 401,
          msg: "Missing an API Key",
        });
      const hash = createHash("sha256").update(bearer).digest("hex");
      const keyData=  await getApiKey(hash)
      if (!keyData || Object.keys(keyData).length === 0)
        throw new APIError({
          status: 401,
          msg: "Unauthorised",
        });
      return {
        keyData: keyData,
      };
    })
    .onOpen(({ ws }) => {
      ws.subscribe(ws.id);
      console.log("Connection opened");
      pingTimeout(ws.id, () => {
        clearSubs(ws.id);
        ws.close();
      });
    })
    .onClose(({ ws }) => {
      clearSubs(ws.id);
      console.log("Connection closed");

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
        console.log("Connection cheesed");

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
      async ({ ws, message, request }) => {
        const key = ws.id + ":" + message.id;
        if (!routePatterns.find(({ regex }) => regex.test(message.path))) {
          ws.publish(ws.id, "result", {
            id: message.id,
            status: 404,
            data: { error: `Unknown path "${message.path}"` },
          });
          return;
        }
        const run = async () => {
          console.log(message);
          const req = new Request("http://internal" + message.path, {
            headers: {
              ...(message.headers ?? {}),
              authorization: request.headers["authorization"],
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
        path: z.string().describe("See /api/v1/docs for all paths to provide here"),
        headers: z.record(z.string(), z.string()).describe("Used for auth set for some scrapers and that").optional(),
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
