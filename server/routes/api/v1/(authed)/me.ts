import Elysia, { t } from "elysia";
import { db, logger } from "@server/lib/utils";
import { users } from "@server/schema/users";
import { eq } from "drizzle-orm";
import { APIError } from "@server/lib/error";
import { keyguard } from "@server/routes/api/v1/(authed)";
import { createSelectSchema } from "drizzle-typebox";
const _users = createSelectSchema(users);

export default new Elysia().use(keyguard).get(
  "",
  async ({ keyData }) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, keyData.userId));
      if (!user) throw new APIError({ status: 401, msg: "unauthorized" });
      return {
        ok: true,
        id: keyData.id,
        user: {
          id: user.id,
          slackId: user.slackId,
        },
        label: keyData.label,
        createdAt: keyData.createdAt,
      };
    } catch (err) {
      logger.error("Failed getting me data via api key", {
        error: err,
      });
      throw new APIError({
        status: 500,
        msg: "internal_server_error",
      });
    }
  },
  {
    detail: {
      tags: ["HCES", "Generic"],
    },
    response: {
      200: t.Object({
        ok: t.Boolean(),
        id: t.String(),
        user: t.Pick(_users, ["id", "slackId"]),
        label: t.String(),
        createdAt: t.Date({
          examples: [new Date()],
        }),
      }),
    },
  },
);
