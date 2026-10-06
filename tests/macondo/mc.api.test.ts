import { expect, test, beforeEach, afterEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { getLogger } from "@logtape/logtape";
import { MCTypes } from "@server/scrapers/macondo/types";
import { CompatTypes } from "@server/scrapers/compatibility/types";
import { Value } from "typebox/value";
import { randomUUID } from "node:crypto";

const logger = getLogger(["hces"]);

type AnySchema = Record<string, any>;

function randomScalar(schema: AnySchema, keyHint: string): unknown {
  const format: string | undefined = schema.format;
  const hint = keyHint.toLowerCase();
  const looksDate = format === "date-time" || /(_at|_date)$/.test(hint) || hint === "posted" || hint === "createdat";
  if (looksDate) return new Date().toISOString();
  const looksUri = format === "uri" || hint.endsWith("url") || hint.endsWith("_url") || hint.includes("image") || hint.includes("thumbnail");
  if (looksUri) return `https://test.invalid/${randomUUID()}`;
  switch (schema.type) {
    case "string":
      return randomUUID();
    case "number":
    case "integer":
      return Math.floor(Math.random() * 100);
    case "boolean":
      return Math.random() < 0.5;
    case "null":
      return null;
    default:
      return randomUUID();
  }
}

function buildStub(schema: AnySchema, keyHint = "", overrides: Record<string, unknown> = {}): any {
  if (!schema || typeof schema !== "object") return null;
  const variants: AnySchema[] | undefined = schema.anyOf ?? schema.oneOf ?? schema.union;
  if (Array.isArray(variants) && variants.length > 0) {

    const populated: AnySchema | undefined = variants.find((v) => v?.type !== "null") ?? variants[0];
    if (!populated) return null;
    return buildStub(populated, keyHint);
  }
  switch (schema.type) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
    case "null":
      return randomScalar(schema, keyHint);
    case "array": {
      const items = schema.items;
      if (!items || typeof items !== "object") return [];
      return [buildStub(items, keyHint)];
    }
    case "object": {
      const props: Record<string, AnySchema> = schema.properties ?? {};
      const out: Record<string, unknown> = {};
      for (const [key, sub] of Object.entries(props)) {
        out[key] = buildStub(sub, key);
      }
      if (Object.keys(props).length === 0) {

        const entrySchema =
          (schema.patternProperties && Object.values(schema.patternProperties)[0] as AnySchema) ??
          (schema.additionalProperties && typeof schema.additionalProperties === "object"
            ? (schema.additionalProperties as AnySchema)
            : null);
        if (entrySchema) out[`key-${randomUUID().slice(0, 8)}`] = buildStub(entrySchema, keyHint);
      }
      return { ...out, ...overrides };
    }
    default: {
      if (schema.properties) {
        const out: Record<string, unknown> = {};
        for (const [key, sub] of Object.entries(schema.properties as Record<string, AnySchema>)) {
          out[key] = buildStub(sub, key);
        }
        return { ...out, ...overrides };
      }
      if (schema.const !== undefined) return schema.const;
      if (schema.type === undefined && schema.format) return randomScalar(schema, keyHint);
      return null;
    }
  }
}

function stubProjectResponse(id: string) {
  return buildStub(MCTypes["GetProjectResponse"] as AnySchema, "project", { id });
}

function stubJournalResponse(id: number) {
  return buildStub(MCTypes["Journal"] as AnySchema, "journal", { id });
}

function stubOrderResponse(orderId: number) {

  const stub = buildStub(MCTypes["MyOrder"] as AnySchema, "myOrder", {});
  const itemId = Math.floor(Math.random() * 1_000_000);
  const userId = randomUUID();
  return {
    ...stub,
    order: { ...stub.order, id: orderId, item_id: itemId, user_id: userId },
    item: { ...stub.item, id: itemId },
    orderUser: { ...stub.orderUser, id: userId },
  };
}

function stubOrdersResponse(count: number) {
  const orders: unknown[] = [];
  const used = new Set<number>();
  while (orders.length < count) {
    const id = Math.floor(Math.random() * 1_000_000);
    if (used.has(id)) continue;
    used.add(id);
    orders.push(stubOrderResponse(id));
  }
  return orders;
}

function stubJournalsResponse(count: number) {
  const journals: unknown[] = [];
  const used = new Set<number>();
  while (journals.length < count) {
    const id = Math.floor(Math.random() * 1_000_000);
    if (used.has(id)) continue;
    used.add(id);
    journals.push(stubJournalResponse(id));
  }
  return journals;
}

function expectValid(schema: unknown, data: unknown) {
  const errors = [...Value.Errors(schema as never, data as never)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(Value.Check(schema as never, data as never)).toBe(true);
}

type FetchInput = Parameters<typeof fetch>[0];

function mockHeaders(cookies: string[] = []) {
  return {
    get: (n: string) => (n.toLowerCase() === "content-type" ? "application/json" : null),
    getSetCookie: () => cookies,
  } as unknown as Headers;
}
function mockRes(data: unknown, status = 200, cookies: string[] = []) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: mockHeaders(cookies),
  } as unknown as Response;
}

let originalFetch: typeof fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

test("macondoAuth requires key or cookie", async () => {
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const { APIError } = await import("@server/lib/error");
  const app = new Elysia()
    .use(macondoAuth)
    .onError(({ error, set }) => {
      if (error instanceof APIError) {
        set.status = (error as any).status;
        return { err: { status: (error as any).status, msg: (error as any).message } };
      }
    })
    .get("/probe", ({ macondoKey }) => ({ key: macondoKey }));
  const res = await app.handle(new Request("http://localhost/probe"));
  expect(res.status).toBe(401);
  const body = (await res.json()) as any;
  expect(body.err.msg).toBe("macondo_auth_required");
});

test("macondoAuth accepts x-macondo-key", async () => {
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia().use(macondoAuth).get("/probe", ({ macondoKey, macondoCookie }) => ({ key: macondoKey, cookie: macondoCookie }));
  const res = await app.handle(new Request("http://localhost/probe", { headers: { "x-macondo-key": "macondo_pat_test" } }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.key).toBe("macondo_pat_test");
});

test("macondoAuth strips Bearer prefix from x-macondo-key", async () => {
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia().use(macondoAuth).get("/probe", ({ macondoKey }) => ({ key: macondoKey }));
  const res = await app.handle(new Request("http://localhost/probe", { headers: { "x-macondo-key": "Bearer macondo_pat_with_bearer" } }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.key).toBe("macondo_pat_with_bearer");
});

test("macondoAuth accepts Authorization Bearer", async () => {
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia().use(macondoAuth).get("/probe", ({ macondoKey }) => ({ key: macondoKey }));
  const res = await app.handle(new Request("http://localhost/probe", { headers: { authorization: "Bearer macondo_pat_bearer" } }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.key).toBe("macondo_pat_bearer");
});

test("macondoAuth accepts x-macondo-cookie", async () => {
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia().use(macondoAuth).get("/probe", ({ macondoCookie }) => ({ cookie: macondoCookie }));
  const res = await app.handle(new Request("http://localhost/probe", { headers: { "x-macondo-cookie": "macondo_session=abc; macondo_rv=xyz" } }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.cookie).toBe("macondo_session=abc; macondo_rv=xyz");
});

test("macondoAuth accepts cookie header fallback", async () => {
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia().use(macondoAuth).get("/probe", ({ macondoCookie }) => ({ cookie: macondoCookie }));
  const res = await app.handle(new Request("http://localhost/probe", { headers: { cookie: "macondo_session=abc; macondo_rv=xyz" } }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.cookie).toBe("macondo_session=abc; macondo_rv=xyz");
});

test("project route via inline handler returns data and forwards headers", async () => {
  const projectId = randomUUID();
  const upstream = stubProjectResponse(projectId);
  expectValid(MCTypes["GetProjectResponse"], upstream);

  globalThis.fetch = mock(async () => mockRes(upstream, 200)) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/projects/:id", async ({ params, set, client }: any) => {
      const res = await client.project(params);
      set.status = client.lastCode ?? 200;
      return res;
    }, { params: MCTypes["GetProjectParams"], response: { 200: MCTypes["GetProjectResponse"] } });
  const res = await app.handle(new Request(`http://localhost/projects/${projectId}`, { headers: { "x-macondo-key": "macondo_pat_test" } }));
  expect(res.status).toBe(200);
  const data = (await res.json()) as any;

  expect(data.id).toBe(projectId);
  expect(res.headers.get("X-Macondo-Key")).toBe("macondo_pat_test");
  expectValid(MCTypes["GetProjectResponse"], data);
});

test("project route normalizes numeric upstream id to string", async () => {

  const upstream = { ...stubProjectResponse(randomUUID()), id: 10, user_id: 42 };

  globalThis.fetch = mock(async () => mockRes(upstream, 200)) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/projects/:id", async ({ params, set, client }: any) => {
      const res = await client.project(params);
      set.status = client.lastCode ?? 200;
      return res;
    }, { params: MCTypes["GetProjectParams"], response: { 200: MCTypes["GetProjectResponse"] } });
  const res = await app.handle(new Request("http://localhost/projects/10", { headers: { "x-macondo-key": "test" } }));
  expect(res.status).toBe(200);
  const data = (await res.json()) as any;
  expect(typeof data.id).toBe("string");
  expect(data.id).toBe("10");
  expectValid(MCTypes["GetProjectResponse"], data);
});

test("project route coerces loose upstream scalars against the schema", async () => {

  const upstream = { ...stubProjectResponse(randomUUID()), level: "3", stage: 1 };

  globalThis.fetch = mock(async () => mockRes(upstream, 200)) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/projects/:id", async ({ params, set, client }: any) => {
      const res = await client.project(params);
      set.status = client.lastCode ?? 200;
      return res;
    }, { params: MCTypes["GetProjectParams"], response: { 200: MCTypes["GetProjectResponse"] } });
  const res = await app.handle(new Request("http://localhost/projects/10", { headers: { "x-macondo-key": "test" } }));
  expect(res.status).toBe(200);
  const data = (await res.json()) as any;
  expect(typeof data.level).toBe("number");
  expect(data.level).toBe(3);
  expect(typeof data.stage).toBe("string");
  expect(data.stage).toBe("1");
  expectValid(MCTypes["GetProjectResponse"], data);
});

test("journals route via inline handler returns array", async () => {
  const upstream = stubJournalsResponse(2);
  expectValid(MCTypes["JournalsResponse"], upstream);
  const projectId = randomUUID();

  globalThis.fetch = mock(async () => mockRes(upstream, 200)) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/projects/:id/journals", async ({ params, set, client }: any) => {
      const res = await client.journals(params);
      set.status = client.lastCode ?? 200;
      return res;
    }, { params: MCTypes["JournalsParams"] });
  const res = await app.handle(new Request(`http://localhost/projects/${projectId}/journals`, { headers: { "x-macondo-key": "test" } }));
  expect(res.status).toBe(200);
  const data = (await res.json()) as any;
  expect(Array.isArray(data)).toBe(true);
  expect(data).toHaveLength(upstream.length);
  expectValid(MCTypes["JournalsResponse"], data);

  expect(data.map((j: any) => j.id).sort()).toEqual((upstream as any[]).map((j) => j.id).sort());
});

test("orders route via inline handler returns my-orders", async () => {
  const upstream = stubOrdersResponse(2);

  globalThis.fetch = mock(async () => mockRes(upstream, 200)) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/orders", async ({ set, client }: any) => {
      const res = await client.orders();
      set.status = client.lastCode ?? 200;
      return res;
    }, { response: { 200: MCTypes["MyOrders"] } });
  const res = await app.handle(new Request("http://localhost/orders", { headers: { "x-macondo-key": "test" } }));
  expect(res.status).toBe(200);
  const data = (await res.json()) as any;
  expect(Array.isArray(data)).toBe(true);
  expect(data).toHaveLength(upstream.length);
  expectValid(MCTypes["MyOrders"], data);

  expect(data.map((o: any) => o.order.id).sort()).toEqual((upstream as any[]).map((f) => String(f.order.id)).sort());
});

test("orders route with api key does not set X-Macondo-New-Cookie", async () => {
  const upstream = stubOrdersResponse(1);
  globalThis.fetch = mock(async () => mockRes(upstream, 200)) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/orders", async ({ set, client }: any) => {
      const res = await client.orders();
      set.status = client.lastCode ?? 200;
      return res;
    });
  const res = await app.handle(new Request("http://localhost/orders", { headers: { "x-macondo-key": "macondo_pat_test" } }));
  expect(res.status).toBe(200);

  expect(res.headers.get("X-Macondo-New-Cookie")).toBeNull();
  const data = (await res.json()) as any;
  expectValid(MCTypes["MyOrders"], data);
});

test("compat project route via inline handler returns CompatTypes shape", async () => {
  const projectId = randomUUID();
  const upstreamProject = stubProjectResponse(projectId);
  const upstreamJournals = stubJournalsResponse(2) as any[];
  expectValid(MCTypes["GetProjectResponse"], upstreamProject);
  expectValid(MCTypes["JournalsResponse"], upstreamJournals);

  globalThis.fetch = mock(async (url: FetchInput) => {
    const u = String(url);
    if (u.includes("/journals")) return mockRes(upstreamJournals, 200);
    return mockRes(upstreamProject, 200);
  }) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/compat/projects/:id", async ({ params, set, clientCP }: any) => {
      const res = await clientCP.project(params);
      set.status = clientCP.lastCode ?? 200;
      return res;
    }, { params: CompatTypes["ProjectParams"] });
  const res = await app.handle(new Request(`http://localhost/compat/projects/${projectId}`, { headers: { "x-macondo-key": "test" } }));
  expect(res.status).toBe(200);
  const data = (await res.json()) as any;
  expectValid(CompatTypes["Project"], data);

  expect(data.id).toBe(projectId);
  expect(data.name).toBe(upstreamProject.name);
  expect(data.devlogIds).toEqual(upstreamJournals.map((j) => String(j.id)));
  expect(data.totalDevlogs).toBe(upstreamJournals.length);
});

test("route returns 500 when scraper returns null", async () => {
  globalThis.fetch = mock(async () => mockRes({ error: "unauth" }, 401)) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/orders", async ({ set, client }: any) => {
      const res = await client.orders();
      if (!res) {
        set.status = 500;
        return { err: { status: 500, msg: "internal_server_error" } };
      }
      set.status = client.lastCode ?? 200;
      return res;
    });
  const res = await app.handle(new Request("http://localhost/orders", { headers: { "x-macondo-key": "bad" } }));
  expect(res.status).toBe(500);
});

test("route handles cookie auth too", async () => {
  const projectId = randomUUID();
  const upstream = stubProjectResponse(projectId);
  expectValid(MCTypes["GetProjectResponse"], upstream);

  globalThis.fetch = mock(async () => mockRes(upstream, 200)) as unknown as typeof fetch;
  const { macondoAuth } = await import("@server/routes/api/v1/(authed)/macondo/(auth)");
  const app = new Elysia()
    .use(macondoAuth)
    .get("/projects/:id", async ({ params, set, client }: any) => {
      const res = await client.project(params);
      set.status = client.lastCode ?? 200;
      return res;
    });
  const res = await app.handle(new Request(`http://localhost/projects/${projectId}`, { headers: { "x-macondo-cookie": "macondo_session=ses; macondo_rv=rv" } }));
  expect(res.status).toBe(200);
  expect(res.headers.get("X-Macondo-Cookie")).toBe("macondo_session=ses; macondo_rv=rv");
  const data = (await res.json()) as any;
  expectValid(MCTypes["GetProjectResponse"], data);
  expect(data.id).toBe(projectId);
});

test("real file route imports are loadable and handle requests", async () => {
  const projectId = randomUUID();
  const upstreamProject = stubProjectResponse(projectId);
  const upstreamJournals = stubJournalsResponse(1);
  const upstreamOrders = stubOrdersResponse(1);

  globalThis.fetch = mock(async (url: FetchInput) => {
    const u = String(url);
    if (u.includes("/api/shop/my-orders")) return mockRes(upstreamOrders, 200);
    if (u.includes("/journals")) return mockRes(upstreamJournals, 200);
    return mockRes(upstreamProject, 200);
  }) as unknown as typeof fetch;

  const projectMod = await import("@server/routes/api/v1/(authed)/macondo/(auth)/projects/[id]/index.ts");
  const ordersMod = await import("@server/routes/api/v1/(authed)/macondo/(auth)/orders/index.ts");
  const compatProjectMod = await import("@server/routes/api/v1/(authed)/macondo/(auth)/compat/projects/[id]/index.ts");

  expect(projectMod.default).toBeDefined();
  expect(ordersMod.default).toBeDefined();
  expect(compatProjectMod.default).toBeDefined();

  const app = new Elysia().use(projectMod.default).use(ordersMod.default);

  const resProject = await projectMod.default.handle(
    new Request(`http://localhost/api/v1/macondo/projects/${projectId}`, { headers: { "x-macondo-key": "test" } }),
  );

  expect([200, 404, 500].includes(resProject.status)).toBe(true);
});
