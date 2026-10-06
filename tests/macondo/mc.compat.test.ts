import { expect, test, beforeEach, afterEach, mock } from "bun:test";
import MacondoCompat from "@server/scrapers/macondo/compat";
import { CompatTypes } from "@server/scrapers/compatibility/types";
import { Value } from "typebox/value";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["hces"]);

const mockProject = {
  id: "proj_123",
  name: "Cool Project",
  description: "A very cool project",
  thumbnail_url: "https://example.com/thumb.png",
  demo_url: "https://example.com/demo",
  repository_url: "https://github.com/example/repo",
  next_ship_ai_usage_description: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

const mockJournals = [
  {
    id: 1,
    short_brief: "First update",
    long_brief: "Built the first version",
    hours: 2.5,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    short_brief: "Second update",
    long_brief: null,
    hours: 1.25,
    created_at: "2026-01-02T00:00:00.000Z",
  },
];

const mockCatalog = [
  {
    id: 10,
    slug: "pinecil",
    name: "Pinecil",
    description: "64 whole pines!",
    image_url: "https://example.com/pinecil.png",
    price_hours: 18,
    stock_remaining: 5,
    price_gold: 18,
    regional_pricing: { US: true },
  },
  {
    id: 20,
    slug: "domain",
    name: "Free Domain",
    description: "domain grant",
    image_url: "https://example.com/domain.png",
    price_hours: 4,
    stock_remaining: null,
    price_gold: 4,
  },
];

type FetchInput = Parameters<typeof fetch>[0];

function mockHeaders(setCookie: string[] = []) {
  return {
    get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
    getSetCookie: () => setCookie,
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

test("compat project maps to CompatTypes.Project", async () => {
  globalThis.fetch = mock(async (url: FetchInput) => {
    const u = String(url);
    if (u.includes("/api/projects/proj_123/journals")) return mockRes(mockJournals, 200);
    if (u.includes("/api/projects/proj_123")) return mockRes(mockProject, 200);
    return mockRes({}, 404);
  }) as unknown as typeof fetch;

  const client = new MacondoCompat({ logger, key: "test" });
  const res = await client.project({ id: "proj_123" });
  const errors = [...Value.Errors(CompatTypes["Project"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(res?.id).toBe("proj_123");
  expect(res?.name).toBe("Cool Project");
  expect(res?.banner).toBe("https://example.com/thumb.png");
  expect(res?.demoUrl).toBe("https://example.com/demo");
  expect(res?.repoUrl).toBe("https://github.com/example/repo");
  expect(res?.devlogIds).toEqual(["1", "2"]);
  expect(res?.totalDevlogs).toBe(2);
  expect(res?.totalDuration).toBe("PT3H45M");
  expect(res?.createdAt).toBe("2026-01-01T00:00:00.000Z");
});

test("compat project handles missing thumbnail and journals", async () => {
  globalThis.fetch = mock(async (url: FetchInput) => {
    const u = String(url);
    if (u.includes("/journals")) return mockRes([], 200);
    return mockRes({ id: "proj_999", name: "NoThumb", description: "desc" }, 200);
  }) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  const res = await client.project({ id: "proj_999" });
  expect(res?.banner).toBeNull();
  expect(res?.totalDevlogs).toBe(0);
  expect(res?.totalDuration).toBe("PT0H0M");
});

test("compat project returns null when underlying fetch fails", async () => {
  globalThis.fetch = mock(async () => mockRes({ error: "not found" }, 404)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  const res = await client.project({ id: "missing" });

  expect(res).not.toBeNull();
});

test("compat shop maps to CompatTypes.ShopItems", async () => {
  globalThis.fetch = mock(async () => mockRes(mockCatalog, 200)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  const res = await client.shop();
  const errors = [...Value.Errors(CompatTypes["ShopItems"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(res).toHaveLength(2);
  expect(res?.[0]?.id).toBe("10");
  expect(res?.[0]?.title).toBe("Pinecil");
  expect(res?.[0]?.price).toBe(18);
  expect(res?.[0]?.avgHours).toBe(18);
  expect(res?.[0]?.stock).toBe(5);
  expect(res?.[1]?.stock).toBeNull();
  expect(res?.[0]?.regionsEnabled).toEqual({ US: true });
});

test("compat shop with id filters single item by id and slug", async () => {
  globalThis.fetch = mock(async () => mockRes(mockCatalog, 200)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  const byId = await client.shop({ id: "10" });
  expect(byId).toHaveLength(1);
  expect(byId?.[0]?.id).toBe("10");
  const bySlug = await client.shop({ id: "pinecil" });
  expect(bySlug).toHaveLength(1);
  expect(bySlug?.[0]?.id).toBe("10");
  const missing = await client.shop({ id: "999" });
  expect(missing).toBeNull();
});

test("compat shop handles NAME_NOT_SET fallback", async () => {
  globalThis.fetch = mock(async () => mockRes([{ id: 99, description: "no name", image_url: null, price_hours: 5 }], 200)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  const res = await client.shop();
  expect(res?.[0]?.title).toBe("NAME_NOT_SET");
});

test("compat devlogs maps journals to CompatTypes.Devlogs", async () => {
  globalThis.fetch = mock(async () => mockRes(mockJournals, 200)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  const res = await client.devlogs({ id: "proj_123" });
  const errors = [...Value.Errors(CompatTypes["Devlogs"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(res).toHaveLength(2);
  expect(res?.[0]?.id).toBe("1");
  expect(res?.[0]?.description).toBe("Built the first version");
  expect(res?.[0]?.timeLogged).toBe("PT2H30M0S");
  expect(res?.[1]?.timeLogged).toBe("PT1H15M0S");
  expect(res?.[0]?.posted).toBe("2026-01-01T00:00:00.000Z");
});

test("compat devlogs single devlogId returns one entry", async () => {
  globalThis.fetch = mock(async () => mockRes(mockJournals, 200)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  const res = await client.devlogs({ id: "proj_123", devlogId: "1" });
  expect(res).toHaveLength(1);
  expect(res?.[0]?.id).toBe("1");
  const missing = await client.devlogs({ id: "proj_123", devlogId: "999" });
  expect(missing).toBeNull();
});

test("compat devlogs handles missing long_brief fallback to short_brief", async () => {
  globalThis.fetch = mock(async () => mockRes([{ id: 3, short_brief: "only short", long_brief: null, hours: 0, created_at: "2026-01-03T00:00:00.000Z" }], 200)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  const res = await client.devlogs({ id: "proj_123" });
  expect(res?.[0]?.description).toBe("only short");
  expect(res?.[0]?.timeLogged).toBe("PT0H0M0S");
});

test("compat lastCode proxies underlying scraper", async () => {
  globalThis.fetch = mock(async () => mockRes(mockCatalog, 200)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "test" });
  await client.shop();
  expect(client.lastCode).toBe(200);

  expect(client.updatedCookie).toBeUndefined();
});

test("compat returns null when shop fetch fails", async () => {
  globalThis.fetch = mock(async () => mockRes({ error: "unauth" }, 401)) as unknown as typeof fetch;
  const client = new MacondoCompat({ logger, key: "bad" });
  const res = await client.shop();
  expect(res).toBeNull();
});
