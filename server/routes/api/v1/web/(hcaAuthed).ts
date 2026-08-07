import Elysia from "elysia";
import { auth } from "../../../../lib/auth";
import { getOrCreateSession } from "../../../../lib/session";
import { db } from "../../../../index";
import { users } from "../../../../schema/users";
import { requestID } from "elysia-requestid";
import { eq } from "drizzle-orm";

export const authGuard = () =>
  new Elysia({ name: "hcaguard" })
    .use(auth)
    .use(requestID())
    .resolve(async ({ authorized, cookie, set }) => {
      if (!(await authorized("hackclub"))) {
        set.status = 403;
        throw new Response(
          JSON.stringify({ err: { status: 403, msg: "forbidden" } }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }

      const s = await getOrCreateSession(cookie);
      const [currentUser] = await db.select().from(users).where(eq(users.id, s.userId!));
      if (!currentUser || Object.keys(currentUser).length === 0) {
        set.status = 403;
        throw new Response(
          JSON.stringify({ err: { status: 403, msg: "forbidden" } }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }
      return { session: { user: currentUser } };
    })
    .as("scoped");

export default new Elysia().use(authGuard());