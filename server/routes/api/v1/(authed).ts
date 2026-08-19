import Elysia from "elysia";
import { db, logger } from "@server/index";
import { eq } from "drizzle-orm";
import { APIError } from "@server/lib/error";
import { bearer } from "@elysia/bearer";
import { apiKeys } from "@server/schema/apiKeys";
import { createHash } from "crypto";
import { errorModel } from "@server/lib/errorModel";
const apiKeyColumns = {
  id: apiKeys.id,
  createdAt: apiKeys.createdAt,
  userId: apiKeys.userId,
  label: apiKeys.label,
  lastUsed: apiKeys.lastUsed,
} as const;
type ApiKeyRow = Pick<typeof apiKeys.$inferSelect, keyof typeof apiKeyColumns>;
const keyCache = new Map<
  string,
  {
    row: ApiKeyRow;
    expiresAt: number;
  }
>();

async function resolveApiKey(hash: string): Promise<ApiKeyRow | null> {
  const cached = keyCache.get(hash);
  if (cached && cached.expiresAt > Date.now()) return cached.row;
  const [keyData] = await db
    .select({
      id: apiKeys.id,
      createdAt: apiKeys.createdAt,
      userId: apiKeys.userId,
      label: apiKeys.label,
      lastUsed: apiKeys.lastUsed,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash));
  if (!keyData || Object.keys(keyData).length === 0) {
    keyCache.delete(hash);
    return null;
  }

  keyCache.set(hash, { row: keyData, expiresAt: Date.now() + 30 * 1000 });
  return keyData;
}

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
      const keyData = await resolveApiKey(hash);
      if (!keyData || Object.keys(keyData).length === 0)
        throw new APIError({
          status: 401,
          msg: "unauthorized",
        });
      if (
        !keyData.lastUsed ||
        Date.now() - keyData.lastUsed.getTime() > 60 * 1000
      ) {
        void db
          .update(apiKeys)
          .set({ lastUsed: new Date() })
          .where(eq(apiKeys.id, keyData.id))
          .catch((err) => logger.error("failed to update lastUsed", { err }));
      }
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
