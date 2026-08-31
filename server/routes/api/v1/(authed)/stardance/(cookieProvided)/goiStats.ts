import Elysia from "elysia";
import { logger } from "@server/lib/utils";
import { APIError } from "@server/lib/error";
import { stardanceCookie } from "@server/routes/api/v1/(authed)/stardance/(cookieProvided)";
import { SDTypes } from "@server/scrapers/stardance/types";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";

export default new Elysia()
  .use(stardanceCookie)
  .use(dispatchGuard(["x-stardance-cookie"]))
  .get(
    "",
    async ({ client }) => {
      try {
        const res = await client.goiStats();
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });
        return res;
      } catch (err) {
        logger.error("Failed getting goi stats data", {
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
        tags: ["Stardance", "Stardance / Generic"],
        security: [{ Header: [], StardanceCookie: [] }],
      },
      response: {
        200: SDTypes["GoiStats"],
      },
    },
  );
