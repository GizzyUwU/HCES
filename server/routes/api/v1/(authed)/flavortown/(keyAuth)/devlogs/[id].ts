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
    async ({ set, client, params }) => {
      try {
        const res = await client.devlog(params)
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });

        set.status = client.lastCode ?? 200;
        return res;
      } catch (err) {
        logger.error("Failed getting ft devlog data", {
          error: err,
          params
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
      params: FTTypes["GetDevlogParams"],
      response: {
        200: FTTypes["GetDevlogResponse"],
      },
    },
  );
