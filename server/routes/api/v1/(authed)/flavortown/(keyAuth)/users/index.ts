import Elysia from "elysia";
import { logger } from "@server/index";
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
        const res = await client.users(query);
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });

        set.status = client.lastCode ?? 200;
        return res;
      } catch (err) {
        logger.error("Failed getting ft all users data", {
          error: err,
          query,
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      detail: {
        tags: ["Flavortown", "Flavortown / Users"],
        security: [{ Header: [], FlavortownKey: [] }],
      },
      query: FTTypes["ListUsersQueryParams"],
      response: {
        200: FTTypes["ListUsersResponse"],
      },
    },
  );
