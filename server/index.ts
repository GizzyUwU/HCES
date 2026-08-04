import { Elysia } from "elysia";
import fsr, { LogLevel } from "elysia-fsr";
import { configure, getConsoleSink } from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { auth } from "./lib/auth";
import { UnverifiedAccountError } from "./lib/error";
import { session } from "./schema/users";
import { eq } from "drizzle-orm";
import { elysiaLogger } from "@logtape/elysia";

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: ["hces"], sinks: ["console"], lowestLevel: "info" }],
  contextLocalStorage: new AsyncLocalStorage(),
});

export const db = drizzle(process.env.DATABASE_URL!);
const routes = await fsr({
  dir: "./routes",
  filter: "**/*.{ts,tsx,js,jsx,mjs,cjs}",
  logLevel: LogLevel.Default,
  // types: {
  //   dir: "./server/types",
  //   importAlias: "import-route-files-alias",
  // },
});

export const app = new Elysia()
  .use(
    elysiaLogger({
      category: ["hces"],
      context: {
        requestId: {
          headerNames: ["x-correlation-id", "x-request-id"],
          responseHeader: "x-request-id",
        },
        include: ["requestId", "method", "path"],
        enrich: (ctx) => ({ route: ctx.path }),
      },
    }),
  )
  .onError(async ({ error, set, cookie }) => {
    if (error instanceof UnverifiedAccountError) {
      const sessionId = cookie["sid"]?.value;

      if (sessionId) {
        await db.delete(session).where(eq(session.id, sessionId));
      }

      cookie["sid"]?.remove();
      set.status = 302;
      set.headers.location = `${process.env.WEB_URL ?? "http://localhost:3000"}/?error=account_unverified`;
      return;
    }
  })
  .use(auth)
  .use(routes)
  .listen(8000, ({ url }) => console.log(`Server is running on ${url}`));
