import Elysia from "elysia";
import { logger } from "@server/index";
import { APIError } from "@server/lib/error";
import { stardanceCookie } from "../(cookieProvided)";
import Stardance from "@server/scrapers/stardance";
import { SDTypes } from "@server/scrapers/stardance/types";
import { dispatchGuard } from "../../dispatchGuard";

export default new Elysia()
  .use(stardanceCookie)
  .use(dispatchGuard(["x-stardance-cookie"]))
  .get(
    "",
    async ({ set, stardanceCookie }) => {
      try {
        const authedClient = new Stardance({
          logger,
          cookie: stardanceCookie,
        });

        const res = await authedClient.goiStats();
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });
        
        set.headers["X-Stardance-New-Cookie"] =
          authedClient.updatedCookie ?? stardanceCookie;
        return res;
      } catch (err) {
        logger.error("Failed getting me data via api key", {
          error: err,
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      response: {
        200: SDTypes["goiStats"],
      },
    },
  );
