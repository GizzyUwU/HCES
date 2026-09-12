import {
  configure,
  getConsoleSink,
  getLogger,
  getTextFormatter,
} from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";
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

  const role =
    process.env["WORKER"] && process.env["ORCHESTRATOR_URL"]
      ? "remote_worker"
      : process.env["WORKER"]
        ? "bundled_worker_orchestrator"
        : "orchestrator";
  Sentry.setTag("node_role", role);
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
  sinks: {
    console: getConsoleSink({
      formatter: getTextFormatter({ timestamp: "time", level: "ABBR" }),
    }),
    sentry: getSentrySink({ breadcrumbs: true }),
  },
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
      filters: ["notExpectedClientError"],
      lowestLevel:
        logLevel[Number(process.env["LOG_LEVEL"]) as keyof typeof logLevel] ??
        "info",
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});
export const logger = getLogger(["hces"]);
