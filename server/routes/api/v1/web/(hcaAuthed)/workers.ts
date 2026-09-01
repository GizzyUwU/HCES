import Elysia, { t } from "elysia";
import { db } from "@server/lib/db";
import { authGuard } from "@server/routes/api/v1/web/(hcaAuthed)";
import tables from "@server/schema";
import { eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-typebox";
import { createHash, randomBytes } from "node:crypto";
import { logger } from "@server/lib/logger";
import { APIError } from "@server/lib/error";
const _workers = createSelectSchema(tables.workers);

function genWorkerSecret() {
  const secret = randomBytes(32).toString("base64url");
  const hash = createHash("sha256")
    .update("worker_sk_" + secret)
    .digest("hex");
  return {
    key: "worker_sk_" + secret,
    hash,
    prefix: "worker_sk_" + secret.slice(0, 5),
  };
}

export default new Elysia()
  .use(authGuard)
  .get(
    "",
    async ({ session: { user } }) => {
      if (!user.admin) throw new APIError({
        status: 403,
        msg: "forbidden"
      })
      try {
        const workers = await db
          .select({
            id: tables.workers.id,
            prefix: tables.workers.prefix,
            label: tables.workers.label,
            connected: tables.workers.connected,
            lastConnectedAt: tables.workers.lastConnectedAt,
            versionSHA: tables.workers.versionSHA,
            createdAt: tables.workers.createdAt,
          })
          .from(tables.workers);

        return workers;
      } catch (err) {
        logger.error("Getting of API Keys threw an err", {
          error: err,
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      response: t.Array(
        t.Pick(_workers, ["id", "prefix", "label", "connected", "lastConnectedAt", "versionSHA", "createdAt"]),
      ),
    },
  )
  .post(
    "",
    async ({ body, session: { user } }) => {
      if (!user.admin) throw new APIError({
        status: 403,
        msg: "forbidden"
      })
      const { label } = body;
      let key: string, hash: string, prefix: string;
      while (true) {
        ({ key, hash, prefix } = genWorkerSecret());
        const exist = await db
          .select({ id: tables.workers.id })
          .from(tables.workers)
          .where(eq(tables.workers.keyHash, hash))
          .limit(1);
        if (exist.length === 0) break;
      }

      try {
        const [created] = await db
          .insert(tables.workers)
          .values({
            prefix,
            keyHash: hash,
            label,
          })
          .returning({
            id: tables.workers.id,
            createdAt: tables.workers.createdAt,
            label: tables.workers.label,
          });

        if (!created) {
          logger.error("Creation of a worker returned nothing");
          throw new APIError({
            status: 500,
            msg: "worker_creation_failed",
          });
        }

        return { ...created, key };
      } catch (err) {
        logger.error("Creation of worker threw an err", {
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
        label: t.Optional(t.String()),
      }),
      response: {
        200: t.Composite([
          t.Pick(_workers, ["id", "createdAt", "label"]),
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
      if (!user.admin) throw new APIError({
        status: 403,
        msg: "forbidden"
      })
      const { id, label } = body;
      const exist = await db
        .select()
        .from(tables.workers)
        .where(
          eq(tables.workers.id, id),
        )
        .limit(1);
      if (exist.length === 0)
        throw new APIError({
          status: 404,
          msg: "worker_doesnt_exist",
        });

      try {
        const [updatedWorker] = await db
          .update(tables.workers)
          .set({
            label,
          })
          .where(eq(tables.workers.id, id))
          .returning({
            label: tables.workers.label,
          });

        if (!updatedWorker) {
          logger.error("Updating worker returned nothing");
          throw new APIError({
            status: 500,
            msg: "worker_update_failed",
          });
        }
        return updatedWorker;
      } catch (err) {
        logger.error("Updating worker threw an error", {
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
        200: t.Pick(_workers, ["label"]),
      },
    },
  )
  .delete(
    "",
    async ({ body, session: { user } }) => {
      if (!user.admin) throw new APIError({
        status: 403,
        msg: "forbidden"
      })
      const { id } = body;
      const exist = await db
        .select({ id: tables.workers.id })
        .from(tables.workers)
        .where(
          eq(tables.workers.id, id),
        );
      if (exist.length === 0)
        throw new APIError({
          status: 404,
          msg: "worker_doesnt_exist",
        });

      try {
        await db
          .delete(tables.workers)
          .where(
           eq(tables.workers.id, id),
          );

        return {
          ok: true,
        };
      } catch (err) {
        logger.error("Failed to delete worker", { error: err });
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
