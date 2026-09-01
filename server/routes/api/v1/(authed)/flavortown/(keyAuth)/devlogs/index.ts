import Elysia from "elysia";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";
import { flavortownKey } from "@server/routes/api/v1/(authed)/flavortown/(keyAuth)";
import { FTTypes } from "@server/scrapers/flavortown/types";

export default new Elysia()
  .use(flavortownKey)
  .use(dispatchGuard(["x-flavortown-key"]))
  .get(
    "",
    async ({ set, client, query }) => {
      try {
        const res = await client.allDevlogs(query)
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });

        set.status = client.lastCode ?? 200;
        return res;
      } catch (err) {
        logger.error("Failed getting ft all devlogs data", {
          error: err,
          query
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      detail: {
        tags: ["Flavortown", "Flavortown / Devlogs"],
        security: [{ Header: [], FlavortownKey: [] }],
      },
      query: FTTypes["ListDevlogsQueryParams"],
      response: {
        200: FTTypes["ListDevlogsResponse"],
      },
    },
  );
