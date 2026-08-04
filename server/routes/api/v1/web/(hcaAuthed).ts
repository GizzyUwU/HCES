import Elysia from "elysia";
import { auth } from "../../../../lib/auth";
import { getOrCreateSession } from "../../../../lib/session";
import { db } from "../../../../index";
import { users } from "../../../../schema/users";
import { eq } from "drizzle-orm";

export const authGuard = () =>
  new Elysia({ name: "hcaguard" })
    .use(auth)
    .resolve(async (ctx) => {
      if (!(await ctx.authorized("hackclub"))) {
        ctx.set.status = 403;
        throw new Response(
          JSON.stringify({ err: { status: 403, msg: "forbidden" } }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }

      const s = await getOrCreateSession(ctx);
      const [currentUser] = await db.select().from(users).where(eq(users.id, s.userId!));

      return { session: { user: currentUser } };
    })
    .as("scoped");

export default new Elysia().use(authGuard());