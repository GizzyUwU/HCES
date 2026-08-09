import Elysia from "elysia";
import { auth } from "../../../../lib/auth";
import { getOrCreateSession } from "../../../../lib/session";
import { db } from "../../../../index";
import { users } from "../../../../schema/users";
import { eq } from "drizzle-orm";
import { APIError } from "@server/lib/error";

export const authGuard = () =>
  new Elysia({ name: "hcaguard" })
    .use(auth)
    .resolve(async ({ authorized, cookie, set }) => {
      if (!(await authorized("hackclub")))
        throw new APIError({
          status: 403,
          msg: "forbidden",
        });

      const s = await getOrCreateSession(cookie);
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, s.userId!));
      if (!currentUser || Object.keys(currentUser).length === 0)
        throw new APIError({
          status: 403,
          msg: "forbidden",
        });
      set.headers["X-User-Id"] = currentUser.id;
      return { session: { user: currentUser } };
    })
    .onAfterHandle(({ set, session }) => {
      set.headers["X-User-Id"] = session.user.id;
    })
    .as("scoped");

export default new Elysia().use(authGuard());
