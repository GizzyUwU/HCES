import Elysia from "elysia";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";
import { macondoAuth } from "@server/routes/api/v1/(authed)/macondo/(auth)";
import { MCTypes } from "@server/scrapers/macondo/types";

export default new Elysia()
  .use(macondoAuth)
  .use(dispatchGuard(["x-macondo-key", "x-macondo-cookie", "authorization", "cookie"]))
  .get(
    "",
    async ({ set, client, params }) => {
      try {
        const res = await client.project(params);
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });
        set.status = client.lastCode ?? 200;
        return res;
      } catch (err) {
        logger.error("Failed getting macondo project data", {
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
        tags: ["Macondo", "Macondo / Projects"],
        security: [{ Header: [], MacondoKey: [], MacondoCookie: [] }],
      },
      params: MCTypes["GetProjectParams"],
      response: {
        200: MCTypes["GetProjectResponse"],
      },
    }
  );
