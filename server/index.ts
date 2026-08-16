import { Elysia } from "elysia";
import fsr, { LogLevel } from "elysia-fsr";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { APIError, UnverifiedAccountError } from "./lib/error";
import { session } from "./schema/users";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { elysiaLogger } from "@logtape/elysia";
import * as Sentry from "@sentry/bun";
import { getSentrySink } from "@logtape/sentry";
import { cron, Patterns } from "@elysiajs/cron";
import openapi from "@elysia/openapi";
import { getPublicOpenApiSpec } from "./lib/openapi";
import { YAML } from "bun";
import { websocketHandler } from "./lib/ws";
import { wsAsyncAPIAdapter } from "@ws-asyncapi/adapter-elysia";
import { getAsyncApiDocument, getAsyncApiUI } from "ws-asyncapi";
import { startRemoteWorker } from "./lib/worker/workerRuntime";
import { enableLocalWorker } from "./lib/worker/workerPool";
import { workerChannel } from "./lib/worker/workerChannel";
if (
  process.env["WORKER"] &&
  process.env["ORCHESTRATOR_URL"] &&
  !process.env["WORKER_KEY"]
)
  throw new Error("WORKER_KEY required with remote workers");

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
      category: ["logtape", "meta"],
      sinks: ["console"],
      lowestLevel: "error",
    },
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

export let db!: ReturnType<typeof drizzle>;
export let app: Elysia<any, any, any, any, any, any, any> | undefined;

export const logger = getLogger(["hces"]);
if (process.env["WORKER"] && process.env["ORCHESTRATOR_URL"]) {
  startRemoteWorker({
    url: process.env["ORCHESTRATOR_URL"]!,
    secret: process.env["WORKER_KEY"]!,
    version: process.env["GIT_COMMIT_SHA"] || "1" !,
  });
 
  new Elysia()
    .get("/health", () => ({
      ok: true,
      mode: "worker",
    }))
    .listen(process.env["PORT"] || 8000, ({ url }) =>
      console.log(`Worker is running on ${url}`),
    );
} else {
   const { auth } = await import("./lib/auth");
  db = drizzle(process.env.DATABASE_URL!);
  const routes = await fsr({
    dir: "./routes",
    filter: "**/*.{ts,tsx,js,jsx,mjs,cjs}",
    logLevel: LogLevel.Default,
  });
  const baseApp = new Elysia()
    .use(
      elysiaLogger({
        category: ["hces"],
        logRequest: false,
        format: (ctx, responseTime) => ({
          method: ctx.request.method,
          path: ctx.path,
          status: ctx.set.status,
          duration: responseTime,
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
     .use(workerChannel)
    .use(
      openapi({
        path: "/api/v1/docs",
        specPath: "/api/v1/docs/openapi-internal/json",
        scalar: {
          url: "/api/v1/docs/json",
        },
      }),
    )
    .use(
      cron({
        name: "sessionCleanup",
        pattern: Patterns.EVERY_10_MINUTES,
        run: async () => {
          const res = await db
            .delete(session)
            .where(
              or(
                lt(session.expiresAt, new Date()),
                and(
                  isNull(session.userId),
                  lt(session.createdAt, new Date(Date.now() - 15 * 60 * 1000)),
                ),
              ),
            )
            .returning({ id: session.id });
          if (res.length > 0) {
            logger.info("Go away stinky stale sessions", { count: res.length });
          }
        },
      }),
    );

  const routedApp = new Elysia().use(routes);
  const socket = websocketHandler(routedApp);
  const channels = [socket];
  const document = getAsyncApiDocument(channels, {
    info: {
      title: "HCES WS",
      version: "v1",
    },
    servers: {
      hces: {
        host: "hces.gizzy.gay", // AsyncAPI url is host[:port][/path], no protocol prefix
        protocol: "wss",
        security: [{ $ref: "#/components/securitySchemes/Header" }],
      },
    },
    components: {
      securitySchemes: {
        Header: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  });
  app = baseApp
    .use(wsAsyncAPIAdapter(channels))
    .get("/api/v1/ws/docs", () => getAsyncApiUI(document, "response"))
    .get("/api/v1/ws/asyncapi.json", () => document)
    .get("/api/v1/docs/json", () => getPublicOpenApiSpec(baseApp))
    .get(
      "/api/v1/docs/yaml",
      () =>
        new Response(YAML.stringify(getPublicOpenApiSpec(baseApp), null, 2), {
          headers: {
            "content-type": "application/yaml; charset=utf-8",
          },
        }),
    )
    .get("/health", () => ({
      ok: true,
      mode: "orchestrator",
    }))
    .listen(process.env["PORT"] || 8000, ({ url }) =>
      console.log(`Server is running on ${url}`),
    );

  if(process.env["WORKER"]) enableLocalWorker();
}
