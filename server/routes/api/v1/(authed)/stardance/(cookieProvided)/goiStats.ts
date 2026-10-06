import Elysia, { type Static } from "elysia";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
import { stardanceCookie } from "@server/routes/api/v1/(authed)/stardance/(cookieProvided)";
import { SDTypes } from "@server/scrapers/stardance/types";
import {
  isLocalWorker,
  pickWorker,
  recordCompletion,
  recordDispatch,
  sendToWorker,
} from "@server/lib/worker/workerPool";
import { applyBrokenLinkStats, refreshReviewLinksInBackground } from "@server/lib/goiReviewLinks";

const INTERNAL_PATH = "/api/v1/stardance/internalGoiQueue";

type InternalPayload = Static<(typeof SDTypes)["GoiStats"]> & {
  queueEntries?: Static<(typeof SDTypes)["GoiQueueEntry"]>[];
};

export default new Elysia().use(stardanceCookie).get(
  "",
  async ({ client, headers, request, stardanceCookie: cookie }) => {
    const picked = await pickWorker(INTERNAL_PATH);
    if (!picked || !picked.workerId)
      throw new APIError({
        status: 503,
        msg: "no_workers_available",
      });
    const { scraper, workerId } = picked;
    const rowId = recordDispatch(workerId, INTERNAL_PATH);
    const startedAt = performance.now();
    const finish = (bytes: number) =>
      void recordCompletion(
        scraper,
        INTERNAL_PATH,
        workerId,
        rowId,
        Math.round(performance.now() - startedAt),
        bytes,
      );

    try {
      let payload: InternalPayload | null;
      if (isLocalWorker(workerId)) {
        request.headers.set("x-hces-worker-id", workerId);
        payload = await client.goiStats();
        if (!payload)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });
        finish(Buffer.byteLength(JSON.stringify(payload), "utf-8"));
      } else {
        const originalCookie = headers["x-stardance-cookie"];
        if (!originalCookie)
          throw new APIError({
            status: 401,
            msg: "stardance_cookie_required",
          });
        let result: Awaited<ReturnType<typeof sendToWorker>>;
        try {
          result = await sendToWorker(workerId, INTERNAL_PATH, {
            "x-stardance-cookie": originalCookie,
          });
        } catch {
          finish(0);
          throw new APIError({
            status: 502,
            msg: "worker_unavailable",
          });
        }
        finish(result.bytes);
        if (result.status !== 200) {
          logger.error("Internal goi queue worker returned non-200", {
            status: result.status,
            data: result.data,
          });
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });
        }
        payload = result.data as InternalPayload;
      }

      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      const merged = applyBrokenLinkStats(payload);
      refreshReviewLinksInBackground(payload.queueEntries ?? [], cookie);
      return merged;
    } catch (err) {
      if (err instanceof APIError) throw err;
      logger.error("Failed getting goi stats data", {
        error: err,
      });
      throw new APIError({
        status: 500,
        msg: "internal_server_error",
      });
    }
  },
  {
    detail: {
      tags: ["Stardance", "Stardance / Generic"],
      security: [{ Header: [], StardanceCookie: [] }],
    },
    response: {
      200: SDTypes["GoiStats"],
    },
  },
);
