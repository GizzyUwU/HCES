import Elysia from "elysia";
import { APIError } from "@server/lib/error";
import { bearer } from "@elysia/bearer";
import { createHash } from "crypto";
import { errorModel } from "@server/lib/errorModel";
import { getApiKey } from "@server/lib/apiKeyCache";

export const keyguard = () =>
  new Elysia({ name: "keyguard" })
    .use(bearer())
    .resolve(async ({ bearer }) => {
      if (!bearer)
        throw new APIError({
          status: 401,
          msg: "unauthorized",
        });
      const hash = createHash("sha256").update(bearer).digest("hex");
      const keyData = await getApiKey(hash);
      if (!keyData || Object.keys(keyData).length === 0)
        throw new APIError({
          status: 401,
          msg: "unauthorized",
        });
      return {
        keyData: keyData,
      };
    })
    .onAfterHandle(({ set, keyData }) => {
      set.headers["X-User-Id"] = keyData.userId;
    })
    .use(errorModel)
    .guard({
      response: {
        401: "unauthorized",
        500: "internalError",
      },
    })
    .as("scoped");

export default new Elysia().use(keyguard());
