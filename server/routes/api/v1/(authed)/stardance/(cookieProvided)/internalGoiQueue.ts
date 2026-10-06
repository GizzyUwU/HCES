import Elysia from "elysia";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
import { stardanceCookie } from "@server/routes/api/v1/(authed)/stardance/(cookieProvided)";

export default new Elysia().use(stardanceCookie).get(
  "",
  async ({ client, request, headers }) => {
    const requestUrl = new URL(request.url);
    const internal =
      headers["x-hces-worker-internal"] === "1" &&
      (requestUrl.host === "internal" ||
        requestUrl.host.includes("127.0.0.1"));
    if (!internal) return new Response("Not Found", { status: 404 });
    try {
      const res = await client.goiStats();
      if (!res)
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      return res;
    } catch (err) {
      logger.error("Failed getting internal goi queue data", {
        error: err,
      });
      throw new APIError({
        status: 500,
        msg: "internal_server_error",
      });
    }
  },
);
