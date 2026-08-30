import Elysia from "elysia";
import { logger } from "@server/index";
import { APIError } from "@server/lib/error";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";
import { flavortownKey } from "@server/routes/api/v1/(authed)/flavortown/(keyAuth)";
import { CPTypes } from "@server/scrapers/compatibility/types";

export default new Elysia()
  .use(flavortownKey)
  .use(dispatchGuard(["x-flavortown-key"]))
  .get(
    "",
    async ({ set, clientCP, params }) => {
      try {
        const res = await clientCP.shop(params)
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });

        set.status = clientCP.lastCode ?? 200;
        return res;
      } catch (err) {
        logger.error("Failed getting ft compat shop item data", {
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
        tags: ["Compatability", "Flavortown", "FlavortownCP / Shop"],
        security: [{ Header: [], FlavortownKey: [] }],
      },
      params: CPTypes["ShopParams"],
      response: {
        200: CPTypes["ShopItems"],
      },
    },
  );
