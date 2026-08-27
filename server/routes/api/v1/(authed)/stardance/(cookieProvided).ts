import Elysia from "elysia";
import { APIError } from "@server/lib/error";
import { errorModel } from "@server/lib/errorModel";
import Stardance from "@server/scrapers/stardance";
import { logger } from "@server/index";
export const stardanceCookie = () =>
  new Elysia({ name: "stardanceCookie" })
    .resolve(async ({ headers, request }) => {
      if (!headers["x-stardance-cookie"])
        throw new APIError({
          status: 401,
          msg: "stardance_cookie_required",
        });
      let cookie = headers["x-stardance-cookie"];
      if (!cookie.startsWith("_stardance_session_4="))
        cookie = "_stardance_session_4=" + cookie;
      const client = new Stardance({ logger, cookie, workerId: request.headers.get("x-hces-worker-id") ?? "" });
      return {
        stardanceCookie: cookie,
        client
      };
    })
    .onAfterHandle(({ set, stardanceCookie, client }) => {
      set.headers["X-Stardance-Cookie"] = stardanceCookie;
      set.headers["X-Stardance-New-Cookie"] = client.updatedCookie ?? "";
    })
    .use(errorModel)
    .guard({
      response: {
        401: "unauthorized",
        500: "internalError",
      },
    })
    .as("scoped");

export default new Elysia().use(stardanceCookie());
