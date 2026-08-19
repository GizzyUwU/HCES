import { expect, test } from "bun:test";
import Stardance from "@server/scrapers/stardance";
import { SDTypes } from "@server/scrapers/stardance/types";
import { Value } from "typebox/value";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "@logtape/logtape";
import { t } from "elysia";

const logger = getLogger(["hces"]);
async function storeResponse(testName: string, res: unknown) {
  const dir = join(join(import.meta.dir, "logs"), "sd");
  await mkdir(dir, {
    recursive: true,
  });
  const file = join(dir, `${testName}.json`);
  await Bun.write(file, JSON.stringify(res, null, 2));
}

const client = new Stardance({
  logger,
});

test("Shop API returns normal data", async () => {
  const res = await client.shop();
  await storeResponse("shop", res);
  const errors = [...Value.Errors(SDTypes.shopItems, res)];
  if (errors.length > 0) console.error(errors);
  expect(errors).toHaveLength(0);
});

test("Project API returns normal data", async () => {
  const res = await client.project({
    id: 10129,
  });
  await storeResponse("project", res);
  const errors = [...Value.Errors(t.Partial(SDTypes.project), res)];
  if (errors.length > 0) console.error(errors);
  expect(errors).toHaveLength(0);
});

if (process.env["STARDANCE_AUTH_COOKIE"]) {
  const authedClient = new Stardance({
    logger,
    cookie: process.env["STARDANCE_AUTH_COOKIE"],
  });

  test("GOI Stats API returns normal data", async () => {
    const res = await authedClient.goiStats();
    await storeResponse("goiStats", res);
    // expect(true).toBe(true)
    const errors = [...Value.Errors(SDTypes.goiStats, res)];
    if (errors.length > 0) console.error(errors);
    expect(errors).toHaveLength(0);
  });
}
