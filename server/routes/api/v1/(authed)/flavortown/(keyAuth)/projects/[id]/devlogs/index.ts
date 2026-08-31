import Elysia from "elysia";
import { logger } from "@server/lib/utils";
import { APIError } from "@server/lib/error";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";
import { flavortownKey } from "@server/routes/api/v1/(authed)/flavortown/(keyAuth)";
import { FTTypes } from "@server/scrapers/flavortown/types";

export default new Elysia()
  .use(flavortownKey)
  .use(dispatchGuard(["x-flavortown-key"]))
  .get(
    "",
    async ({ set, client, params, query }) => {
      try {
        const res = await client.devlogs(params, query)
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });

        set.status = client.lastCode ?? 200;
        return res;
      } catch (err) {
        logger.error("Failed getting ft devlogs data", {
          error: err,
          params,
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
        tags: ["Flavortown", "Flavortown / Projects"],
        security: [{ Header: [], FlavortownKey: [] }],
      },
      params: FTTypes["ListProjectDevlogsParams"],
      query: FTTypes["ListProjectDevlogsQueryParams"],
      response: {
        200: FTTypes["ListProjectDevlogsResponse"],
      },
    },
  );
