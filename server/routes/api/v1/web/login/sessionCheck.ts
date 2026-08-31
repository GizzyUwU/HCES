import Elysia, { t }  from "elysia";
import { auth } from "@server/lib/auth";
import { db } from "@server/lib/utils";
import { getOrCreateSession } from "@server/lib/session";
import { users } from "@server/schema/users";
import { eq } from "drizzle-orm";
import { APIError } from "@server/lib/error";
import { createSelectSchema } from "drizzle-typebox";
import tables from "@server/schema";
const _users = createSelectSchema(tables.users);

export default new Elysia().use(auth).get(
  "",
  async (ctx) => {
    if (!(await ctx.authorized("hackclub")))
      throw new APIError({
        status: 401,
        msg: "unauthorised",
      });
    const s = await getOrCreateSession(ctx.cookie);
    if (!s.userId)
      throw new APIError({
        status: 401,
        msg: "unauthorised",
      });

    const [user] = await db
      .select({
        id: users.id,
        slackId: users.slackId,
        hcaId: users.hcaId,
        admin: users.admin,
      })
      .from(users)
      .where(eq(users.id, s.userId));

    if (!user)
      throw new APIError({
        status: 401,
        msg: "unauthorised",
      });
    return {
      ok: true,
      user: {
        id: user.id,
        slackId: user.slackId,
        hcaId: user.hcaId,
        admin: user.admin,
      },
    };
  },
  {
    detail: {
      hide: true,
    },
    response: {
      200: t.Object({
        ok: t.Literal(true),
        user: t.Pick(_users, ["id", "slackId", "hcaId", "admin"]),
      }),
    },
  },
);
