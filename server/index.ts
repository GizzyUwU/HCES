import { Elysia } from "elysia";
import fsr, { LogLevel } from "elysia-fsr";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { auth } from "./lib/auth";
import { APIError, UnverifiedAccountError } from "./lib/error";
import { session } from "./schema/users";
import { eq } from "drizzle-orm";
import { elysiaLogger } from "@logtape/elysia";
import * as Sentry from "@sentry/bun";
import { getSentrySink } from "@logtape/sentry";

if (process.env["SENTRY_DSN"]) {
  Sentry.init({
    dsn: process.env["SENTRY_DSN"],
    release:
      process.env["GIT_COMMIT_SHA"] || process.env["SENTRY_NAME"] || "hces",
    environment:
      Boolean(process.env["PRODUCTION"]) === true
        ? "production"
        : "development",
    tracesSampleRate: 0.01,
  });
}

const logLevel = {
  1: "warning",
  2: "trace",
  3: "info",
  4: "fatal",
  5: "error",
  6: "debug",
} as const;

await configure({
  sinks: { console: getConsoleSink(), sentry: getSentrySink() },
  filters: {
    notExpectedClientError: (record) =>
      !(
        record.level === "error" &&
        typeof record.properties["status"] === "number" &&
        (record.properties["status"] as number) >= 400 &&
        (record.properties["status"] as number) < 500
      ),
  },
  loggers: [
    {
      category: ["hces"],
      sinks: [
        "console",
        ...(process.env["SENTRY_DSN"] ? (["sentry"] as const) : []),
      ],
      lowestLevel:
        logLevel[Number(process.env["LOG_LEVEL"]) as keyof typeof logLevel] ??
        "info",
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

export const logger = getLogger(["hces"]);
export const db = drizzle(process.env.DATABASE_URL!);
const routes = await fsr({
  dir: "./routes",
  filter: "**/*.{ts,tsx,js,jsx,mjs,cjs}",
  logLevel: LogLevel.Default,
});

export const app = new Elysia()
  .use(
    elysiaLogger({
      category: ["hces"],
      logRequest: false, 
      format: (ctx, responseTime) => ({
        method: ctx.request.method,
        path: ctx.path,
        status: ctx.set.status,
        duration: responseTime
      }),
      context: {
        requestId: {
          headerNames: ["x-correlation-id", "x-request-id"],
          responseHeader: "x-request-id",
        },
        include: ["requestId", "method", "path"],
        enrich: async (ctx) => {
          const cookieHeader = ctx.request.headers.get("cookie") ?? "";
          const sid = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/)?.[1];
        
          let userId: string | undefined;
          if (sid) {
            const [s] = await db
              .select({ userId: session.userId })
              .from(session)
              .where(eq(session.id, sid))
              .limit(1);
            userId = s?.userId ?? undefined;
          }
        
          return { route: ctx.path, userId };
        },
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
    } else if (error instanceof APIError) {
      set.status = error.status;
      return {
        err: { status: error.status, msg: error.message },
      };
    } else {
      throw error;
    }
  })
  .use(auth)
  .use(routes)
  .listen(8000, ({ url }) => console.log(`Server is running on ${url}`));
