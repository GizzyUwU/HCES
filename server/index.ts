import { Elysia } from "elysia";
import fsr, { LogLevel } from "elysia-fsr";
import { APIError, UnverifiedAccountError } from "@server/lib/error";
import { session } from "@server/schema/users";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { elysiaLogger } from "@logtape/elysia";
import { cron, Patterns } from "@elysiajs/cron";
import openapi from "@elysia/openapi";
import { getPublicOpenApiSpec } from "@server/lib/openapi";
import { YAML } from "bun";
import { websocketHandler } from "@server/lib/ws";
import { wsAsyncAPIAdapter } from "@ws-asyncapi/adapter-elysia";
import { getAsyncApiDocument, getAsyncApiUI } from "ws-asyncapi";
import { startRemoteWorker } from "@server/lib/worker/workerRuntime";
import { cors } from "@elysia/cors";
import prometheusRegistry from "@server/lib/metrics";
import {
  enableLocalWorker,
  resetStaleConnections,
} from "@server/lib/worker/workerPool";
import { workerChannel } from "@server/lib/worker/workerChannel";
import { OpenPanel } from "@openpanel/sdk";
import { preconnectScrapers } from "@server/scrapers/preconnect";
import { join } from "node:path";
import { Counter, Histogram } from "prom-client";
import { db, logger } from "@server/lib/utils";
if (process.env["WORKER"] && !process.env["WORKER_KEY"])
  throw new Error("WORKER_KEY required to be a worker");

export let app: Elysia<any, any, any, any, any, any, any> | undefined;

export let opClient: OpenPanel | undefined = undefined;
if (
  (!process.env["WORKER"] ||
    (process.env["WORKER"] && !process.env["ORCHESTRATOR_URL"])) &&
  process.env["OP_CLIENT_ID"] &&
  process.env["OP_CLIENT_SECRET"] &&
  process.env["OP_SERVER_URL"]
) {
  opClient = new OpenPanel({
    apiUrl: process.env["OP_SERVER_URL"],
    clientId: process.env["OP_CLIENT_ID"],
    clientSecret: process.env["OP_CLIENT_SECRET"],
  });
  logger.info("OpenPanel logs are active");
} else if (
  !process.env["WORKER"] ||
  (process.env["WORKER"] && !process.env["ORCHESTRATOR_URL"])
) {
  logger.info("OpenPanel envs isnt set so it's not active");
}

if (process.env["WORKER"] && process.env["ORCHESTRATOR_URL"]) {
  startRemoteWorker({
    url: process.env["ORCHESTRATOR_URL"]!,
    secret: process.env["WORKER_KEY"]!,
    version: process.env["GIT_COMMIT_SHA"] || "1"!,
  });

  new Elysia()
    .get("/health", () => ({
      ok: true,
      mode: "worker",
    }))
    .listen(process.env["PORT"] || 8000, ({ url }) =>
      console.log(`Worker is running on ${url}`),
    );

  preconnectScrapers();
} else {
  const { auth } = await import("@server/lib/auth");

  await resetStaleConnections();
  const requestStartTimes = new WeakMap<Request, number>();
  const httpRequests = new Counter({
    name: "http_requests_total",
    help: "Total num of requests",
    labelNames: ["method", "path", "status"],
    registers: [prometheusRegistry],
  });
  const httpRequestDuration = new Histogram({
    name: "http_requests_duration",
    help: "Duration of requests in seconds",
    labelNames: ["method", "path", "status"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [prometheusRegistry],
  });

  const getClientIp = (request: Request) => {
    if (Boolean(process.env["TRUST_X_FORWARDED_FOR"]) === true) {
      return (
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
      );
    }

    return app?.server?.requestIP(request)?.address ?? "unknown";
  };

  const routes = await fsr({
    dir: join(import.meta.dir, "routes"),
    filter: "**/*.{ts,tsx,js,jsx,mjs,cjs}",
    logLevel: LogLevel.Verbose,
  });
  const baseApp = new Elysia()
    .use(routes)
    .onRequest(({ request }) => {
      requestStartTimes.set(request, performance.now());
      logger.info(
        `HTTP - ${request.method} - ${getClientIp(request)} - ${request.url}`,
        {
          ip: getClientIp(request),
          method: request.method,
          url: request.url,
        },
      );
    })
    .onAfterHandle(({ request, set, route }) => {
      const start = requestStartTimes.get(request);
      if (!start) return;
      const duration = (performance.now() - start) / 1000;
      httpRequests.inc({
        method: request.method,
        path: route,
        status: set.status ?? 200,
      });
      httpRequestDuration.observe(
        {
          method: request.method,
          path: route,
          status: set.status ?? 200,
        },
        duration,
      );
    })
    .use(
      elysiaLogger({
        category: ["hces"],
        logRequest: false,
        skip: () => true,
        format: (ctx, responseTime) => ({
          method: ctx.request.method,
          path: new URL(ctx.request.url),
          status: ctx.set.status,
          responseTime,
        }),
        context: {
          requestId: {
            headerNames: ["x-correlation-id", "x-request-id"],
            responseHeader: "x-request-id",
          },
          include: ["requestId", "method", "path"],
        },
      }),
    )
    .get("/metrics", async ({ set }) => {
      set.headers["content-type"] = prometheusRegistry.contentType;
      return prometheusRegistry.metrics();
    })
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
    .use(workerChannel)
    .use(
      cors({
        origin: true,
        methods: "*",
        allowedHeaders: "*",
        exposeHeaders: "*",
        credentials: false,
      }),
    )
    .use(
      openapi({
        path: "/api/v1/docs",
        specPath: "/api/v1/docs/openapi-internal/json",
        scalar: {
          url: "/api/v1/docs.json",
          metaData: {
            title: "HCES Docs",
          },
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
    .get("/api/v1/ws/docs.json", () => document)
    .get(
      "/api/v1/ws/docs.yaml",
      () =>
        new Response(YAML.stringify(document, null, 2), {
          headers: {
            "content-type": "application/yaml; charset=utf-8",
          },
        }),
    )
    .get("/api/v1/docs.json", () => getPublicOpenApiSpec(baseApp))
    .get(
      "/api/v1/docs.yaml",
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

  if (process.env["WORKER"]) {
    preconnectScrapers();
    enableLocalWorker(
      process.env["WORKER_KEY"]!,
      process.env["GIT_COMMIT_SHA"] || "1"!,
    );
  }
}

const rawConsoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const text = args
    .map((a) => (a instanceof Error ? a.message : String(a)))
    .join(" ");
  if (
    text.includes(
      "[exact-mirror] TypeBox's TypeCompiler is required to use Union",
    )
  ) {
    return;
  }
  rawConsoleWarn(...args);
};
