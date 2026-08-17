import { expect, test } from "bun:test";
import { SDTypes } from "@server/scrapers/stardance/types";
import { Value } from "typebox/value";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

async function storeResponse(testName: string, res: unknown) {
  const dir = join(join(import.meta.dir, "logs"), "sdApi")
  await mkdir(dir, {
    recursive: true,
  })
  const file = join(dir, `${testName}.json`);
  await Bun.write(file, JSON.stringify(res, null, 2))
}

// test("Shop API returns normal data", async () => {
//   const res = await client.shop()
//   const errors = [...Value.Errors(SDTypes.shopItems, res)];
//   if (errors.length > 0) console.error(errors)
//   expect(errors).toHaveLength(0);
// });

if (process.env["TEST_API_KEY"] && process.env["STARDANCE_AUTH_COOKIE"]) {
  test("GOI Stats API returns normal data", async () => {
    const res = await fetch("http://localhost:8000/api/v1/stardance/goiStats", {
      headers: {
        Authorization: "Bearer " + process.env["TEST_API_KEY"]!,
        "X-Stardance-Cookie": process.env["STARDANCE_AUTH_COOKIE"]!
      }
    })
    expect(res.headers.get("x-stardance-new-cookie")).toBeTruthy();
    const data = await res.json();
    await storeResponse("goiStats", data)
    const errors = [...Value.Errors(SDTypes["goiStats"], data)];
    if (errors.length > 0) console.error(errors)
    expect(errors).toHaveLength(0);
  });
}
