import Elysia from "elysia";
import { auth } from "@server/lib/auth";
import { db } from "@server/index";
import { getOrCreateSession } from "@server/lib/session";
import { users } from "@server/schema/users";
import { eq } from "drizzle-orm";

export default new Elysia()
  .use(auth)
  .get("", async (ctx) => {
    if (!(await ctx.authorized("hackclub"))) return { ok: false };
    const s = await getOrCreateSession(ctx as any);
    if (!s.userId) return { ok: false };

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, s.userId));

    if (!user) return { ok: false };
    return {
      ok: true,
      user: {
        id: user.id,
        slackId: user.slackId,
        hcaId: user.hcaId,
      },
    };
  });
