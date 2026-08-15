import Elysia from "elysia";
import { APIError } from "@server/lib/error";
import { errorModel } from "@server/lib/errorModel";
import {  pickWorker, recordCompletion, recordDispatch, sendToWorker } from "@server/lib/workerPool";

export const dispatchGuard = (path: string, forwardHeaders: string[]) =>
  new Elysia({ name: `dispatchGuard:${path}` })
    .derive(() => ({
      dispatchRowId: null as string | null,
      dispatchStartedAt: 0 as number
    }))
    .onBeforeHandle(async ({ path, set, headers, dispatchRowId, dispatchStartedAt }) => {
      const workerId = await pickWorker(path);
      if (!workerId) throw new APIError({
        status: 503,
        msg: "no_workers_available"
      })
      const rowId = await recordDispatch(workerId, path);
      const startedAt = performance.now();
      if (workerId === "local") {
        dispatchRowId = rowId;
        dispatchStartedAt = startedAt;
        return;
      }
      const forwarded: Record<string, string> = {};
      for (const name of forwardHeaders) {
        const value = headers[name];
        if (value) forwarded[name] = value;
      }

      try {
        const result = await sendToWorker(workerId, path, forwarded);
        recordCompletion(rowId, Math.round(performance.now() - startedAt));
        set.status = result.status;
        return result.data;
      } catch {
        recordCompletion(rowId, Math.round(performance.now() - startedAt));
        throw new APIError({
          status: 502,
          msg: "worker_unavailable"
        })
      }
    })
    .onAfterHandle(({
      dispatchRowId, dispatchStartedAt
    }) => {
      if (!dispatchRowId) return;
      recordCompletion(dispatchRowId, Math.round(performance.now() - dispatchStartedAt))
    })
    .use(errorModel)
    .guard({
      response: {
        401: "unauthorized",
        500: "internalError",
      },
    })
    .as("scoped");
