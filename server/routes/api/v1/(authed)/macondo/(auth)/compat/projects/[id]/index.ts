import Elysia from "elysia";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";
import { macondoAuth } from "@server/routes/api/v1/(authed)/macondo/(auth)";
import { CompatTypes } from "@server/scrapers/compatibility/types";

export default new Elysia()
  .use(macondoAuth)
  .use(dispatchGuard(["x-macondo-key", "x-macondo-cookie", "authorization", "cookie"]))
  .get(
    "",
    async ({ set, clientCP, params }) => {
      try {
        const res = await clientCP.project(params);
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });
        set.status = clientCP.lastCode ?? 200;
        return res;
      } catch (err) {
        logger.error("Failed getting macondo compat project data", {
          error: err,
          params,
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      detail: {
        tags: ["Compatability", "Macondo", "Macondo Compat / Projects"],
        security: [{ Header: [], MacondoKey: [], MacondoCookie: [] }],
      },
      params: CompatTypes["ProjectParams"],
      response: {
        200: CompatTypes["Project"],
      },
    }
  );
