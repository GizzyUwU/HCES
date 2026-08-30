import Elysia from "elysia";
import { logger } from "@server/index";
import { APIError } from "@server/lib/error";
import StardanceCP from "@server/scrapers/stardance/cp";
import { CPTypes } from "@server/scrapers/compatibility/types";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";

export default new Elysia().use(dispatchGuard(["x-stardance-cookie"])).get(
  "",
  async ({ set, headers, request, params }) => {
    try {
      let cookie = headers["x-stardance-cookie"] ?? "";
      if (cookie.length > 0 && !cookie.startsWith("_stardance_session_4="))
        cookie = "_stardance_session_4=" + cookie;
      const client = new StardanceCP({ logger, cookie, workerId: request.headers.get("x-hces-worker-id") ?? "" });
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
      tags: ["Compatability", "Stardance", "StardanceCP / Projects"],
    },
    params: CPTypes["ProjectParams"],
    response: {
      200: CPTypes["Devlogs"],
    },
  },
);
