import Elysia, { t } from "elysia";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";
import { flavortownKey } from "@server/routes/api/v1/(authed)/flavortown/(keyAuth)";
import { CompatTypes } from "@server/scrapers/compatibility/types";

export default new Elysia()
  .use(flavortownKey)
  .use(dispatchGuard(["x-flavortown-key"]))
  .get(
    "",
    async ({ set, clientCP, params }) => {
      try {
        const res = await clientCP.devlogs(params)
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });

        set.status = clientCP.lastCode ?? 200;
        return res;
      } catch (err) {
        logger.error("Failed getting ft compat devlogs data", {
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
        tags: ["Compatability", "Flavortown", "Flavortown Compat / Projects"],
        security: [{ Header: [], FlavortownKey: [] }],
      },
      params: t.Omit(CompatTypes["DevlogParams"], ["devlogId"]),
      response: {
        200: CompatTypes["Devlogs"]
      },
    },
  );
