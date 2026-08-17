import Elysia from "elysia";
import { errorModel } from "@server/lib/errorModel";
import {
    isLocalWorker,
  pickWorker,
  recordCompletion,
  recordDispatch,
  sendToWorker,
} from "@server/lib/worker/workerPool";

const localDispatches = new WeakMap<
  Request,
  { rowId: string; startedAt: number }
  >();

function jsonResponse(status: number, body: unknown, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
       headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export const dispatchGuard = (forwardHeaders: string[]) =>
  new Elysia({ name: `dispatchGuard` })
    .derive(() => ({
      dispatchRowId: null as string | null,
      dispatchStartedAt: 0 as number,
    }))
    .onBeforeHandle(async ({ path, set, headers, request }) => {
      const requestUrl = new URL(request.url);
      const isInternalWorkerRequest =
        headers["x-hces-worker-internal"] === "1" && (requestUrl.host === "internal" || requestUrl.host.includes("127.0.0.1"));

      if (isInternalWorkerRequest) return;

      const workerId = await pickWorker(path);
      if (!workerId)
        return jsonResponse(503, { err: { status: 503, msg: "no_workers_available" } });
      const rowId = await recordDispatch(workerId, path);
      const startedAt = performance.now();
      if (isLocalWorker(workerId)) {
        localDispatches.set(request, {
          rowId, startedAt
        })
        return;
      }
      const forwarded: Record<string, string> = {};
      for (const name of forwardHeaders) {
        const value = headers[name];
        if (value) forwarded[name] = value;
      }

      try {
        const result = await sendToWorker(workerId, path, forwarded);
        recordCompletion(
          rowId,
          Math.round(performance.now() - startedAt),
          result.bytes,
        );
        set.status = result.status;
        return jsonResponse(result.status, result.data, result.headers);
      } catch {
        recordCompletion(
          rowId,
          Math.round(performance.now() - startedAt),
          0
        );
        return jsonResponse(502, { err: { status: 502, msg: "worker_unavailable" } });
      }
    })
    .onAfterHandle(({ request, response }) => {
      const dispatched = localDispatches.get(request)
      if (!dispatched) return;
      localDispatches.delete(request);
      const bytes = Buffer.byteLength(JSON.stringify(response ?? null), "utf-8");
      recordCompletion(
        dispatched.rowId,
        Math.round(performance.now() - dispatched.startedAt),
        bytes
      );
    })
    .use(errorModel)
    .guard({
      response: {
        401: "unauthorized",
        500: "internalError",
      },
    })
    .as("scoped");
