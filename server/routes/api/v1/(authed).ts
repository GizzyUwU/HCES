import Elysia from "elysia";
import { db, logger } from "../../../index";
import { eq } from "drizzle-orm";
import { APIError } from "@server/lib/error";
import { bearer } from "@elysia/bearer";
import { apiKeys } from "@server/schema/apiKeys";
import { createHash } from "crypto";
import { errorModel } from "@server/lib/errorModel";

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
      const [keyData] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hash));
      if (!keyData || Object.keys(keyData).length === 0)
        throw new APIError({
          status: 401,
          msg: "unauthorized",
        });

      db.update(apiKeys)
        .set({ lastUsed: new Date() })
        .where(eq(apiKeys.id, keyData.id))
        .catch((err) => logger.error("failed to update lastUsed", { err }));
      return {
        keyData: keyData
      }
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
