import Elysia, { t } from "elysia";
import { db } from "@server/index";
import { getOrCreateSession } from "@server/lib/session";
import { users } from "@server/schema/users";
import { eq } from "drizzle-orm";
import { authGuard } from "../(hcaAuthed)";
import { logger } from "@server/index";
import { APIError } from "@server/lib/error";
import { createSelectSchema } from "drizzle-typebox";
const _users = createSelectSchema(users);

export default new Elysia()
  .use(authGuard)
  .get(
    "",
    async (ctx) => {
      try {
        const s = await getOrCreateSession(ctx.cookie);
        if (!s.userId) throw new APIError({ status: 401, msg: "unauthorized" });

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, s.userId));

        if (!user) throw new APIError({ status: 401, msg: "unauthorized" });
        return {
          ok: true,
          user: {
            id: user.id,
            slackId: user.slackId,
            hcaId: user.hcaId,
          },
        };
      } catch (err) {
        logger.error("Deletion of a user failed", {
          error: err,
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      response: t.Object({
        ok: t.Boolean(),
        user: t.Pick(_users, ["id", "slackId", "hcaId"]),
      }),
    },
  )
  .delete(
    "",
    async ({ session: { user } }) => {
      try {
        await db.delete(users).where(eq(users.id, user.id));

        return {
          ok: true,
        };
      } catch (err) {
        logger.error("Deletion of a user failed", {
          error: err,
        });
        throw new APIError({
          status: 500,
          msg: "internal_server_error",
        });
      }
    },
    {
      response: t.Object({
        ok: t.Boolean(),
      }),
    },
  );
