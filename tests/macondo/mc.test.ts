import { expect, test, beforeEach, afterEach, mock } from "bun:test";
import Macondo from "@server/scrapers/macondo";
import { MCTypes } from "@server/scrapers/macondo/types";
import { Value } from "typebox/value";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["hces"]);

async function storeResponse(name: string, res: unknown) {
  const dir = join(import.meta.dir, "logs");
  await mkdir(dir, { recursive: true });
  await Bun.write(join(dir, `${name}.json`), JSON.stringify(res, null, 2));
}

const mockProject = {
  id: "proj_123",
  user_id: "user_456",
  name: "Test Project",
  type: "software",
  description: "A very cool project",
  fruit: "apple",
  level: 2,
  stage: "shipping",
  demo_url: "https://example.com/demo",
  thumbnail_url: "https://example.com/thumb.png",
  repository_url: "https://github.com/example/repo",
  hackatime_projects: ["example-project"],
  is_fork: false,
  guide: null,
  html_content: "<p>hello</p>",
  css_content: "body {}",
  readme_content: "# readme",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  has_active_grant: false,
  pendingFruit: 0,
};

const mockJournals = [
  {
    id: 1,
    short_brief: "First update",
    long_brief: "Built the first version with lots of details",
    hours: 2.5,
    created_at: "2026-01-01T00:00:00.000Z",
    archived: false,
    archived_at: null,
    content_language: "en",
    author_id: "user_456",
    author_username: "example-user",
    author_slack_id: "U00000000",
    author_image: "https://example.com/avatar.png",
  },
  {
    id: 2,
    short_brief: "Second update",
    long_brief: "Second iteration",
    hours: 1,
    created_at: "2026-01-02T00:00:00.000Z",
    archived: false,
    archived_at: null,
    content_language: "en",
    author_id: "user_456",
    author_username: "example-user",
    author_slack_id: "U00000000",
    author_image: "https://example.com/avatar.png",
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
    price_fruit_type: "gold",
    price_fruit_amount: 18,
    stock_remaining: 5,
    available: true,
    is_purchasable: true,
    is_sold_out: false,
    category: "hardware",
    kind: "item",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    price_gold: 18,
    regional_pricing: { US: true, EU: true },
  },
  {
    id: 20,
    slug: "domain",
    name: "Free Domain",
    description: "an $11 grant to buy a domain!",
    image_url: "https://example.com/domain.png",
    price_hours: 4,
    stock_remaining: null,
    available: true,
    is_purchasable: true,
    is_sold_out: false,
    category: "grant",
    kind: "grant",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    price_gold: 4,
  },
];

const mockOg = {
  name: "Example Project",
  ownerName: "example-user",
  ownerImage: "https://example.com/avatar.png",
  type: "software",
  hours: 12.5,
  hasThumbnail: true,
  thumbnailUrl: "https://example.com/thumb.png",
};

const mockHackatime = {
  hackatimeBreakdown: [{ name: "example-project", hours: 12.5 }],
  contributors: [
    {
      user_id: "user_456",
      username: "example-user",
      slack_id: "U00000000",
      image: "https://example.com/avatar.png",
      is_owner: true,
      is_self: true,
      projects: [{ name: "example-project", hours: 12.5 }],
    },
  ],
};

function createMockHeaders(setCookie: string[] = []) {
  return {
    get: (name: string) => {
      if (name.toLowerCase() === "content-type") return "application/json";
      return null;
    },
    getSetCookie: () => setCookie,
  } as unknown as Headers;
}

function createMockResponse(data: unknown, status = 200, setCookie: string[] = []) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: createMockHeaders(setCookie),
  } as unknown as Response;
}

type FetchInput = Parameters<typeof fetch>[0];

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

test("project returns valid GetProjectResponse shape", async () => {
  globalThis.fetch = mock(async (url: FetchInput) => {
    const u = String(url);
    expect(u).toContain("/api/projects/proj_123");
    return createMockResponse(mockProject, 200);
  }) as unknown as typeof fetch;

  const client = new Macondo({ logger, key: "macondo_pat_test" });
  const res = await client.project({ id: "proj_123" });
  await storeResponse("project", res);
  const errors = [...Value.Errors(MCTypes["GetProjectResponse"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(res?.id).toBe("proj_123");
  expect(res?.name).toBe("Test Project");
  expect(client.lastCode).toBe(200);
});

test("project forwards Authorization header and returns error payload on 404", async () => {
  let capturedHeaders: Record<string, string> = {};
  globalThis.fetch = mock(async (_url: FetchInput, init?: RequestInit) => {
    capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
    return createMockResponse({ error: "not found" }, 404);
  }) as unknown as typeof fetch;

  const client = new Macondo({ logger, key: "macondo_pat_123" });
  const res = await client.project({ id: "missing" });
  expect(capturedHeaders["authorization"]!).toBe("Bearer macondo_pat_123");

  expect(res).not.toBeNull();
  expect((res as unknown as { error: string }).error).toBe("not found");
  expect(client.lastCode).toBe(404);
});

test("project with cookie sets Cookie header", async () => {
  let capturedHeaders: Record<string, string> = {};
  globalThis.fetch = mock(async (_url: FetchInput, init?: RequestInit) => {
    capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
    return createMockResponse(mockProject, 200);
  }) as unknown as typeof fetch;

  const client = new Macondo({ logger, cookie: "macondo_session=old; macondo_rv=rv_old" });
  const res = await client.project({ id: "proj_123" });
  expect(res).not.toBeNull();
  expect(capturedHeaders["cookie"]!).toBe("macondo_session=old; macondo_rv=rv_old");

  expect(client.updatedCookie).toBeUndefined();
});

test("journals returns array matching JournalsResponse", async () => {
  globalThis.fetch = mock(async (url: FetchInput) => {
    expect(String(url)).toContain("/api/projects/proj_123/journals");
    return createMockResponse(mockJournals, 200);
  }) as unknown as typeof fetch;

  const client = new Macondo({ logger, key: "macondo_pat_test" });
  const res = await client.journals({ id: "proj_123" });
  await storeResponse("journals", res);
  const errors = [...Value.Errors(MCTypes["JournalsResponse"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(res!).toHaveLength(2);
  expect((res as unknown as typeof mockJournals)[0]!.id).toBe(1);
});

test("journals handles wrapped {journals: [...]} shape", async () => {
  globalThis.fetch = mock(async () => createMockResponse({ journals: mockJournals }, 200)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.journals({ id: "proj_123" });
  expect(res!).toHaveLength(2);
});

test("journals coerces loose upstream scalars against the schema", async () => {
  const loose = [{ ...mockJournals[0]!, id: "1", hours: "2.5" }];
  globalThis.fetch = mock(async () => createMockResponse(loose, 200)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.journals({ id: "proj_123" });
  const errors = [...Value.Errors(MCTypes["JournalsResponse"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(typeof (res as any)![0]!.id).toBe("number");
  expect((res as any)![0]!.hours).toBe(2.5);
});

test("journal finds single entry by id", async () => {
  globalThis.fetch = mock(async () => createMockResponse(mockJournals, 200)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.journal({ id: "proj_123", journalId: "2" });
  expect(res?.id).toBe(2);
  expect(res?.short_brief).toBe("Second update");
});

test("journal returns null when not found", async () => {
  globalThis.fetch = mock(async () => createMockResponse(mockJournals, 200)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.journal({ id: "proj_123", journalId: "999" });
  expect(res).toBeNull();
});

test("shop returns ShopItems with normalized ids", async () => {
  globalThis.fetch = mock(async (url: FetchInput) => {
    expect(String(url)).toContain("/_ui/catalog");
    return createMockResponse(mockCatalog, 200);
  }) as unknown as typeof fetch;

  const client = new Macondo({ logger, key: "test" });
  const res = await client.shop();
  await storeResponse("shop", res);
  const errors = [...Value.Errors(MCTypes["ShopItems"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(res!).toHaveLength(2);
  expect(res?.[0]?.id).toBe("10");
  expect(res?.[0]?.name).toBe("Pinecil");
  expect(res?.[0]?.price_hours).toBe(18);
  expect(res?.[0]?.regionsEnabled).toEqual({ US: true, EU: true });
  expect(res?.[1]?.regionsEnabled).toBeNull();
});

test("shop handles {items: [...]} wrapper", async () => {
  globalThis.fetch = mock(async () => createMockResponse({ items: mockCatalog }, 200)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.shop();
  expect(res!).toHaveLength(2);
});

test("shopItem finds by id and by slug", async () => {
  globalThis.fetch = mock(async () => createMockResponse(mockCatalog, 200)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const byId = await client.shopItem({ id: "10" });
  expect(byId?.slug).toBe("pinecil");
  const bySlug = await client.shopItem({ id: "pinecil" });
  expect(bySlug?.id).toBe("10");
});

test("shopItem returns null when not found", async () => {
  globalThis.fetch = mock(async () => createMockResponse(mockCatalog, 200)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.shopItem({ id: "nonexistent" });
  expect(res).toBeNull();
});

test("shop returns null on non-ok", async () => {
  globalThis.fetch = mock(async () => createMockResponse({ error: "unauthorized" }, 401)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "bad" });
  const res = await client.shop();
  expect(res).toBeNull();
  expect(client.lastCode).toBe(401);
});

test("og returns valid OgResponse", async () => {
  globalThis.fetch = mock(async (url: FetchInput) => {
    expect(String(url)).toContain("/api/projects/proj_123/og");
    return createMockResponse(mockOg, 200);
  }) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.og({ id: "proj_123" });
  const errors = [...Value.Errors(MCTypes["OgResponse"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(res?.name).toBe("Example Project");
});

test("hackatimeBreakdown returns valid shape", async () => {
  globalThis.fetch = mock(async () => createMockResponse(mockHackatime, 200)) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.hackatimeBreakdown({ id: "proj_123" });
  const errors = [...Value.Errors(MCTypes["HackatimeBreakdownResponse"], res)];
  if (errors.length) console.error(errors);
  expect(errors).toHaveLength(0);
  expect(res?.hackatimeBreakdown?.[0]?.hours).toBe(12.5);
});

test("handles network error gracefully", async () => {
  globalThis.fetch = mock(async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  const res = await client.project({ id: "proj_123" });
  expect(res).toBeNull();
  const res2: unknown = await (client as unknown as { request: (p: string) => Promise<Response> }).request("/api/projects/proj_123").catch((e: unknown) => e);
  expect((res2 as Error).message).toBe("Macondo API failed with an error");
});

test("both key and cookie set both headers", async () => {
  let captured: Record<string, string> = {};
  globalThis.fetch = mock(async (_url: FetchInput, init?: RequestInit) => {
    captured = Object.fromEntries(new Headers(init?.headers).entries());
    return createMockResponse(mockProject, 200);
  }) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "macondo_pat_test", cookie: "macondo_session=abc; macondo_rv=xyz" });
  await client.project({ id: "proj_123" });
  expect(captured["authorization"]!).toBe("Bearer macondo_pat_test");
  expect(captured["cookie"]!).toBe("macondo_session=abc; macondo_rv=xyz");
});

test("query params are appended correctly", async () => {
  let capturedUrl = "";
  globalThis.fetch = mock(async (url: FetchInput) => {
    capturedUrl = String(url);
    return createMockResponse(mockProject, 200);
  }) as unknown as typeof fetch;
  const client = new Macondo({ logger, key: "test" });
  await (client as unknown as { request: (p: string, o?: unknown) => Promise<Response> }).request("/api/projects/proj_123", {
    query: { page: 2, q: "hello", empty: "" },
  });
  expect(capturedUrl).toContain("page=2");
  expect(capturedUrl).toContain("q=hello");
  expect(capturedUrl).not.toContain("empty=");
});
