import Elysia from "elysia";
import { APIError } from "@server/lib/error";
import { errorModel } from "@server/lib/errorModel";
import { logger } from "@server/lib/logger";
import Flavortown from "@server/scrapers/flavortown";
import FlavortownCompat from "@server/scrapers/flavortown/compat";
export const flavortownKey = () =>
  new Elysia({ name: "flavortownKey" })
    .resolve(async ({ headers, request }) => {
      let key = headers["x-flavortown-key"];
      if (!key)
        throw new APIError({
          status: 401,
          msg: "flavortown_key_required",
        });
      const client = new Flavortown({ logger, key, workerId: request.headers.get("x-hces-worker-id") ?? "" });
      const clientCP = new FlavortownCompat({ logger, key, workerId: request.headers.get("x-hces-worker-id") ?? "" });
      return {
        key,
        client,
        clientCP
      };
    })
    .onAfterHandle(({ set, key }) => {
      set.headers["X-Flavortown-Key"] = key
    })
    .use(errorModel)
    .guard({
      response: {
        401: "unauthorized",
        500: "internalError",
      },
    })
    .as("scoped");

export default new Elysia().use(flavortownKey());
