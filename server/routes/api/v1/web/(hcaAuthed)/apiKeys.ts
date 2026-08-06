import Elysia, { t } from "elysia";
import { db } from "@server/index";
import { authGuard } from "@server/routes/api/v1/web/(hcaAuthed)";
import tables from "@server/schema";
import { eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-typebox";
const _apiKeys = createSelectSchema(tables.apiKeys);

export default new Elysia().use(authGuard).get(
  "",
  async ({ session: { user } }) => {
    const apiKeys = await db
      .select({
        id: tables.apiKeys.id,
        prefix: tables.apiKeys.prefix,
        label: tables.apiKeys.label,
        lastUsed: tables.apiKeys.lastUsed,
        createdAt: tables.apiKeys.createdAt,
      })
      .from(tables.apiKeys)
      .where(eq(tables.apiKeys.userId, user.id));

    return apiKeys;
  },
  {
    response: t.Array(
      t.Pick(_apiKeys, ["id", "prefix", "label", "lastUsed", "createdAt"]),
    ),
  },
);
