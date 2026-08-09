import Elysia, { t } from "elysia";
import { db } from "@server/index";
import { authGuard } from "@server/routes/api/v1/web/(hcaAuthed)";
import tables from "@server/schema";
import { and, count, eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-typebox";
import { createHash, randomBytes } from "node:crypto";
import { logger } from "@server/index";
import { APIError } from "@server/lib/error";
const _apiKeys = createSelectSchema(tables.apiKeys);

function genAPIKey() {
  const secret = randomBytes(32).toString("base64url");
  const hash = createHash("sha256")
    .update("hces_sk_" + secret)
    .digest("hex");
  return {
    key: "hces_sk_" + secret,
    hash,
    prefix: "hces_sk_" + secret.slice(0, 5),
  };
}

export default new Elysia()
  .use(authGuard)
  .derive(() => ({}) as { requestID: string })
  .get(
    "",
    async ({ session: { user } }) => {
      try {
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
      } catch (err) {
        logger.error("Getting of API Keys threw an err", {
          error: err
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      response: t.Array(
        t.Pick(_apiKeys, ["id", "prefix", "label", "lastUsed", "createdAt"]),
      ),
    },
  )
  .post(
    "",
    async ({ body, set, session: { user } }) => {
      const { label } = body;
      const countRows = await db
        .select({ count: count() })
        .from(tables.apiKeys)
        .where(eq(tables.apiKeys.userId, user.id));

      if (countRows[0] && countRows[0].count >= 5) {
        set.status = 403;
        return { err: { status: 403, msg: "max_apikey_limit" } };
      }

      let key: string, hash: string, prefix: string;
      while (true) {
        ({ key, hash, prefix } = genAPIKey());
        const exist = await db
          .select({ id: tables.apiKeys.id })
          .from(tables.apiKeys)
          .where(eq(tables.apiKeys.keyHash, hash))
          .limit(1);
        if (exist.length === 0) break;
      }

      try {
      const [created] = await db
        .insert(tables.apiKeys)
        .values({
          userId: user.id,
          prefix,
          keyHash: hash,
          label,
        })
        .returning({
          id: tables.apiKeys.id,
          createdAt: tables.apiKeys.createdAt,
          label: tables.apiKeys.label,
        });

      if (!created) {
        logger.error("Creation of API Key returned nothing");
        throw new APIError({
          status: 500,
          msg: "apikey_creation_failed",
        });
      }

        return { ...created, key };
      } catch (err) {
        logger.error("Creation of API Key threw an err", {
          error: err
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      body: t.Object({
        label: t.Optional(t.String()),
      }),
      response: {
        200: t.Composite([
          t.Pick(_apiKeys, ["id", "createdAt", "label"]),
          t.Object({ key: t.String() }),
        ]),
        403: t.Object({
          err: t.Object({
            status: t.Number(),
            msg: t.String(),
          }),
        }),
        500: t.Object({
          err: t.Object({
            status: t.Number(),
            msg: t.String(),
          }),
        }),
      },
    },
  )
  .put(
    "",
    async ({ body, session: { user } }) => {
      const { id, label } = body;
      const exist = await db
        .select()
        .from(tables.apiKeys)
        .where(
          and(eq(tables.apiKeys.userId, user.id), eq(tables.apiKeys.id, id)),
        )
        .limit(1);
      if (exist.length === 0)
        throw new APIError({
          status: 404,
          msg: "apikey_doesnt_exist",
        });

      try {
        const [updatedKey] = await db
          .update(tables.apiKeys)
          .set({
            label,
          })
          .where(eq(tables.apiKeys.id, id))
          .returning({
            id: tables.apiKeys.id,
            label: tables.apiKeys.label,
          });

        if (!updatedKey) {
          logger.error("Updating API Key returned nothing");
          throw new APIError({
            status: 500,
            msg: "apikey_update_failed",
          });
        }
        return updatedKey;
      } catch (err) {
        logger.error("Updating API Key threw an error", {
          error: err,
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      body: t.Object({
        id: t.String(),
        label: t.String(),
      }),
      response: {
        200: t.Pick(_apiKeys, ["id", "label"]),
      },
    },
  )
  .delete(
    "",
    async ({ body, session: { user } }) => {
      const { id } = body;
      const exist = await db
        .select({ id: tables.apiKeys.id })
        .from(tables.apiKeys)
        .where(
          and(eq(tables.apiKeys.userId, user.id), eq(tables.apiKeys.id, id)),
        );
      if (exist.length === 0)
        throw new APIError({
          status: 404,
          msg: "apikey_doesnt_exist",
        });

      try {
        await db
          .delete(tables.apiKeys)
          .where(
            and(eq(tables.apiKeys.userId, user.id), eq(tables.apiKeys.id, id)),
          );

        return {
          ok: true,
        };
      } catch (err) {
        logger.error("Failed to delete API key", { error: err });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      body: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          ok: t.Boolean(),
        }),
      },
    },
  );
