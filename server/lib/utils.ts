import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";
import * as Sentry from "@sentry/bun";
import { getSentrySink } from "@logtape/sentry";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readdir } from "node:fs/promises";
import { migrate } from "drizzle-orm/node-postgres/migrator";

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
export const logger = getLogger(["hces"]);

export let db: ReturnType<typeof drizzle> = drizzle({
  client: new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: Number(process.env["DB_POOL_MAX"]) || 20,
    idleTimeoutMillis: 30 * 1000,
    connectionTimeoutMillis: 5 * 1000,
  }),
});

let migrationsExists = true;

try {
  await readdir("./migrations");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    migrationsExists = false;
  } else {
    throw error;
  }
}

if (migrationsExists) {
  await migrate(db, {
    migrationsFolder: "./migrations",
  });
}

