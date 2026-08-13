import Elysia from "elysia";
import { APIError } from "@server/lib/error";
import { errorModel } from "@server/lib/errorModel";

export const stardanceCookie = () =>
  new Elysia({ name: "stardanceCookie" })
    .resolve(async ({ headers }) => {
      if (!headers["x-stardance-cookie"])
        throw new APIError({
          status: 401,
          msg: "unauthorized",
        });
      let cookie = headers["x-stardance-cookie"];
      if (!cookie.startsWith("_stardance_session_4="))
        cookie = "_stardance_session_4=" + cookie;

      return {
        stardanceCookie: cookie
      };
    })
    .onAfterHandle(({ set, stardanceCookie }) => {
      set.headers["X-Stardance-Cookie"] = stardanceCookie;
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
