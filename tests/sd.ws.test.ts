import { expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createClient, type WebSocketLike } from "@ws-asyncapi/client";
import type { websocketHandler } from "@server/lib/ws";

if (!process.env["TEST_API_KEY"])
  throw new Error("This requires a test api key!");

async function storeResponse(testName: string, res: unknown) {
  const dir = join(join(import.meta.dir, "logs"), "sdApi");
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${testName}.json`);
  await Bun.write(file, JSON.stringify(res, null, 2));
}

function connect(apiKey: string) {
  return createClient<ReturnType<typeof websocketHandler>>(
    "ws://127.0.0.1:8000",
    "/api/v1/ws",
    {
      socket: (url) =>
        new WebSocket(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        }) as WebSocketLike,
      heartbeat: false,
    },
  );
}

function waitForResult(
  client: ReturnType<typeof connect>,
  id: string,
  timeoutMs = 5000,
) {
  return new Promise<{ id: string; status: number; data: unknown }>(
    (resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for result ${id}`)),
        timeoutMs,
      );
      const off = client.onEvent("result", (data) => {
        if (data.id !== id) return;
        clearTimeout(timer);
        off();
        resolve(data);
      });
    },
  );
}

// if (process.env["STARDANCE_AUTH_COOKIE"]) {
//   test("WS start: goiStats one-shot (no intervalMs)", async () => {
//     const client = connect(process.env["TEST_API_KEY"]!);
//     await client.opened;

//     const id = crypto.randomUUID();
//     const resultPromise = waitForResult(client, id);

//     client.call("start", {
//       id,
//       path: "/api/v1/stardance/goiStats",
//       headers: {
//         "X-Stardance-Cookie": process.env["STARDANCE_AUTH_COOKIE"]!,
//       },
//     });

//     const result = await resultPromise;
//     expect(result.status).toBe(200);
//     await storeResponse("wsGoiStatsOneShot", result.data);

//     const errors = [...Value.Errors(SDTypes["GoiStats"], result.data)];
//     if (errors.length > 0) console.error(errors);
//     expect(errors).toHaveLength(0);

//     client.close();
//   });

//   test("WS start: goiStats with intervalMs delivers repeated results", async () => {
//     const client = connect(process.env["TEST_API_KEY"]!);
//     await client.opened;

//     const id = crypto.randomUUID();
//     const results: { id: string; status: number; data: unknown }[] = [];
//     const gotTwo = new Promise<void>((resolve) => {
//       client.onEvent("result", (data) => {
//         if (data.id !== id) return;
//         results.push(data);
//         if (results.length >= 2) resolve();
//       });
//     });

//     client.call("start", {
//       id,
//       path: "/api/v1/stardance/goiStats",
//       headers: {
//         "X-Stardance-Cookie": process.env["STARDANCE_AUTH_COOKIE"]!,
//       },
//       intervalMs: 750,
//     });

//     await Promise.race([
//       gotTwo,
//       new Promise<never>((_, reject) =>
//         setTimeout(
//           () => reject(new Error("timed out waiting for two interval results")),
//           5000,
//         ),
//       ),
//     ]);

//     expect(results.length).toBeGreaterThanOrEqual(2);
//     for (const r of results) expect(r.status).toBe(200);

//     const cancelled = new Promise<void>((resolve) => {
//       client.onEvent("cancelled", (data) => {
//         if (data.id === id) resolve();
//       });
//     });
//     client.call("stop", { id });

//     await Promise.race([
//       cancelled,
//       new Promise<never>((_, reject) =>
//         setTimeout(() => reject(new Error("timed out waiting for cancelled")), 5000),
//       ),
//     ]);

//     client.close();
//   });
// }

test("WS start: public project lookup, no Stardance cookie needed", async () => {
  const client = connect(process.env["TEST_API_KEY"]!);
  await client.opened;

  const id = crypto.randomUUID();
  const resultPromise = waitForResult(client, id);

  client.call("start", {
    id,
    path: "/api/v1/stardance/projects/10129",
  });

  const result = await resultPromise;
  console.log(result)
  expect(result.status).toBe(200);
  await storeResponse("wsProject10129", result.data);

  client.close();
});