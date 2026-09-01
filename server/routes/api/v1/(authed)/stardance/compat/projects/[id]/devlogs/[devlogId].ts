import Elysia from "elysia";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
import StardanceCompat from "@server/scrapers/stardance/compat";
import { CompatTypes } from "@server/scrapers/compatibility/types";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";

export default new Elysia().use(dispatchGuard(["x-stardance-cookie"])).get(
  "",
  async ({ set, headers, request, params }) => {
    try {
      let cookie = headers["x-stardance-cookie"] ?? "";
      if (cookie.length > 0 && !cookie.startsWith("_stardance_session_4="))
        cookie = "_stardance_session_4=" + cookie;
      const client = new StardanceCompat({ logger, cookie, workerId: request.headers.get("x-hces-worker-id") ?? "" });

      const res = await client.devlogs(params);
      if (!res)
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });

      if (cookie.length > 0)
        set.headers["X-Stardance-New-Cookie"] = client.updatedCookie ?? "";
      set.status = client.lastCode ?? 200;
      return res;
    } catch (err) {
      logger.error("Failed getting project data", {
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
      tags: ["Compatability", "Stardance", "StardanceCompat / Projects"],
    },
    params: CompatTypes["DevlogParams"],
    response: {
      200: CompatTypes["Devlogs"],
    },
  },
);
