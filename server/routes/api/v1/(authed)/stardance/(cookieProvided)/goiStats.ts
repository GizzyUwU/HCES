import Elysia from "elysia";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
import { stardanceCookie } from "@server/routes/api/v1/(authed)/stardance/(cookieProvided)";
import { dispatchGuard } from "@server/routes/api/v1/(authed)/dispatchGuard";
import { SDTypes } from "@server/scrapers/stardance/types";

export default new Elysia()
  .use(stardanceCookie)
  .use(dispatchGuard(["x-stardance-cookie"]))
  .get(
    "",
    async ({ set, client }) => {
      try {
        const res = await client.goiStats();
        if (!res)
          throw new APIError({
            status: 500,
            msg: "internal_server_error",
          });
        set.status = client.lastCode ?? 200;
        return res;
      } catch (err) {
        if ((err as APIError)?.name === "StardanceCookieExpiredError") {
          // Already logged with logger.error inside the scraper (-> Sentry).
          throw err;
        }
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
        description:
          "GOI-stats scrape. Returns 401 `stardance_cookie_expired` when the Stardance session cookie is expired/invalid (stale cookies previously returned all-zeros), or 401 `stardance_cookie_required` when no cookie was sent.",
      },
      response: {
        200: SDTypes["GoiStats"],
      },
    },
  );
