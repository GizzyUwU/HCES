import Elysia from "elysia";
import { db } from "@server/index";
import { getOrCreateSession } from "@server/lib/session";
import { users } from "@server/schema/users";
import { eq } from "drizzle-orm";
import { authGuard } from "../(hcaAuthed)";
import { logger } from "@server/index";
import { APIError } from "@server/lib/error";

export default new Elysia()
  .use(authGuard)
  .get("", async (ctx) => {
    const s = await getOrCreateSession(ctx.cookie);
    if (!s.userId) return { ok: false };

    const [user] = await db.select().from(users).where(eq(users.id, s.userId));

    if (!user) return { ok: false };
    return {
      ok: true,
      user: {
        id: user.id,
        slackId: user.slackId,
        hcaId: user.hcaId,
      },
    };
  })
  .delete("", async ({ session: { user } }) => {
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
  });
