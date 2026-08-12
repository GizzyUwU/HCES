import { expect, test } from "bun:test";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import * as Sentry from "@sentry/bun";
import { getSentrySink } from "@logtape/sentry";
import Stardance from "@server/scrapers/stardance";
import { SDTypes } from "@server/scrapers/stardance/types";
import { Value } from "typebox/value";
import { readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";

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
      sinks: [
        "console",
      ],
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
});

const logger = getLogger(["hces"]);
async function storeResponse(testName: string, res: unknown) {
  const dir = join(join(import.meta.dir, "logs"), "sd")
  await mkdir(dir, {
    recursive: true,
  })
  const file = join(dir, `${testName}.json`);
  await Bun.write(file, JSON.stringify(res, null, 2))
}

const client = new Stardance({
  logger,
})

// test("Shop API returns normal data", async () => {
//   const res = await client.shop()
//   const errors = [...Value.Errors(SDTypes.shopItems, res)];
//   if (errors.length > 0) console.error(errors)
//   expect(errors).toHaveLength(0);
// });

if (process.env["STARDANCE_AUTH_COOKIE"]) {
  const authedClient = new Stardance({
    logger,
    cookie: process.env["STARDANCE_AUTH_COOKIE"]
  })

  test("GOI Stats API returns normal data", async () => {
    const res = await authedClient.goiStats()
    await storeResponse("goiStats", res)
    expect(true).toBe(true)
    // const errors = [...Value.Errors(SDTypes.shopItems, res)];
    // if (errors.length > 0) console.error(errors)
    // expect(errors).toHaveLength(0);
  });
}