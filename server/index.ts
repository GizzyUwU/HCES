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
  loggers: [
    {
      category: ["hces"],
      sinks: [
        "console",
        ...(process.env["SENTRY_DSN"] ? (["sentry"] as const) : []),
      ],
      lowestLevel: logLevel[Number(process.env["LOG_LEVEL"]) as keyof typeof logLevel]  ?? "info",
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
    } else if (error instanceof APIError) {
      set.status = error.status;
      return new Response(
        JSON.stringify({ err: { status: error.status, msg: error.message } }),
      );
    } else {
      throw error;
    }
  })
  .use(auth)
  .use(routes)
  .listen(8000, ({ url }) => console.log(`Server is running on ${url}`));
