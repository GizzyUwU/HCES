import Elysia from "elysia";
import { APIError } from "@server/lib/error";
import { errorModel } from "@server/lib/errorModel";
import { logger } from "@server/lib/logger";
import Macondo from "@server/scrapers/macondo";
import MacondoCompat from "@server/scrapers/macondo/compat";

export const macondoAuth = () =>
  new Elysia({ name: "macondoAuth" })
    .resolve(async ({ headers, request }) => {
      let key = headers["x-macondo-key"] ?? headers["authorization"]?.replace(/^Bearer\s+/i, "") ?? null;
      let cookie = headers["x-macondo-cookie"] ?? headers["cookie"] ?? null;
      if (!key && !cookie)
        throw new APIError({
          status: 401,
          msg: "macondo_auth_required",
        });
      if (key && key.startsWith("Bearer ")) key = key.slice(7);
      if (cookie && !cookie.includes("macondo_session") && !cookie.includes("macondo_rv")) {
        cookie = cookie;
      }
      const client = new Macondo({ logger, key: key ?? undefined, cookie: cookie ?? undefined, workerId: request.headers.get("x-hces-worker-id") ?? "" });
      const clientCP = new MacondoCompat({ logger, key: key ?? undefined, cookie: cookie ?? undefined, workerId: request.headers.get("x-hces-worker-id") ?? "" });
      return {
        macondoKey: key,
        macondoCookie: cookie,
        client,
        clientCP,
      };
    })
    .onAfterHandle(({ set, macondoKey, macondoCookie, client }) => {
      if (macondoKey) set.headers["X-Macondo-Key"] = macondoKey;
      if (macondoCookie) set.headers["X-Macondo-Cookie"] = macondoCookie;
      const updated = (client as any).updatedCookie;
      if (updated) set.headers["X-Macondo-New-Cookie"] = updated;
    })
    .use(errorModel)
    .guard({
      response: {
        401: "unauthorized",
        500: "internalError",
      },
    })
    .as("scoped");

export default new Elysia().use(macondoAuth());
