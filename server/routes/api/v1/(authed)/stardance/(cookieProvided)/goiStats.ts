import Elysia from "elysia";
import { logger } from "@server/index";
import { APIError } from "@server/lib/error";
import { stardanceCookie } from "../(cookieProvided)";
import { SDTypes } from "@server/scrapers/stardance/types";
import { dispatchGuard } from "../../dispatchGuard";

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
        tags: ["Stardance"],
        security: [{ Header: [], StardanceCookie: [] }],
      },
      response: {
        200: SDTypes["GoiStats"],
      },
    },
  );
