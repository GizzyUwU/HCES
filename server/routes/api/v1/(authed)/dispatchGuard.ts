import Elysia from "elysia";
import { APIError } from "@server/lib/error";
import { errorModel } from "@server/lib/errorModel";
import {
  pickWorker,
  recordCompletion,
  recordDispatch,
  sendToWorker,
} from "@server/lib/worker/workerPool";

const localDispatches = new WeakMap<
  Request,
  { rowId: string; startedAt: number }
>();
export const dispatchGuard = (path: string, forwardHeaders: string[]) =>
  new Elysia({ name: `dispatchGuard:${path}` })
    .derive(() => ({
      dispatchRowId: null as string | null,
      dispatchStartedAt: 0 as number,
    }))
    .onBeforeHandle(async ({ path, set, headers, request }) => {
      const workerId = await pickWorker(path);
      if (!workerId)
        throw new APIError({
          status: 503,
          msg: "no_workers_available",
        });
      const rowId = await recordDispatch(workerId, path);
      const startedAt = performance.now();
      if (workerId === "local") {
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
        return result.data;
      } catch {
        recordCompletion(
          rowId,
          Math.round(performance.now() - startedAt),
          0
        );
        throw new APIError({
          status: 502,
          msg: "worker_unavailable",
        });
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
