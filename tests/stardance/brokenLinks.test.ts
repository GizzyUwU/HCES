import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { load } from "cheerio";
import { Value } from "typebox/value";
import { SDTypes } from "@server/scrapers/stardance/types";

process.env["BROKEN_LINKS_DB_PATH"] = join(
  tmpdir(),
  `broken-links-test-${randomUUID()}.sqlite`,
);

const {
  BROKEN_LINK_TTL_MS,
  brokenCountOrNull,
  countBrokenLinks,
  getBrokenLinkDebugState,
  getDueLinks,
  isBrokenStatus,
  isFresh,
  normalizeProjectLink,
  rememberProjectLinks,
  selectOldestUnbroken,
} = await import("@server/lib/brokenLinks");
const { getBrokenLinksDb } = await import("@server/lib/brokenLinks/db");
const { brokenProjectLinks } = await import(
  "@server/lib/brokenLinks/schema"
);

test("broken link TTL is 2 days", () => {
  expect(BROKEN_LINK_TTL_MS).toBe(2 * 24 * 60 * 60 * 1000);
});

test("normalizeProjectLink strips /admin from queue project hrefs", () => {
  expect(normalizeProjectLink("/admin/projects/53422")).toEqual({
    projectId: 53422,
    url: "/projects/53422",
  });
  expect(normalizeProjectLink("/projects/123")).toEqual({
    projectId: 123,
    url: "/projects/123",
  });
  expect(normalizeProjectLink("/admin/projects/53422/")).toEqual({
    projectId: 53422,
    url: "/projects/53422",
  });
  expect(normalizeProjectLink(null)).toBeNull();
  expect(normalizeProjectLink("")).toBeNull();
  expect(normalizeProjectLink("  ")).toBeNull();
  expect(normalizeProjectLink("/admin/certification/review/4339")).toBeNull();
  expect(normalizeProjectLink("/admin/projects/abc")).toBeNull();
  expect(normalizeProjectLink("https://example.com/projects/1")).toBeNull();
});

test("project href is extracted from the queue Project cell", () => {
  const $ = load(
    `<table><tbody><tr>
      <td data-label="Project">
        <a href="/admin/projects/53422">KiberovCats</a>
      </td>
    </tr></tbody></table>`,
  );
  const href = $('td[data-label="Project"] a').attr("href");
  expect(normalizeProjectLink(href)).toEqual({
    projectId: 53422,
    url: "/projects/53422",
  });
});

test("only 404 counts as broken", () => {
  expect(isBrokenStatus(404)).toBe(true);
  expect(isBrokenStatus(200)).toBe(false);
  expect(isBrokenStatus(302)).toBe(false);
  expect(isBrokenStatus(500)).toBe(false);
});

test("isFresh honors the 2 day TTL", () => {
  const now = Date.now();
  expect(isFresh(now, now)).toBe(true);
  expect(isFresh(now - BROKEN_LINK_TTL_MS + 1000, now)).toBe(true);
  expect(isFresh(now - BROKEN_LINK_TTL_MS - 1000, now)).toBe(false);
  expect(isFresh(null, now)).toBe(false);
  expect(isFresh(undefined, now)).toBe(false);
});

test("broken links are counted per category from the sqlite cache", () => {
  rememberProjectLinks([
    { projectId: 1, url: "/projects/1", type: "Web App", hours: 10, devlogs: 4 },
    { projectId: 2, url: "/projects/2", type: "Web App", hours: 20, devlogs: 6 },
    { projectId: 3, url: "/projects/3", type: "CLI", hours: 30, devlogs: 8 },
  ]);

  const db = getBrokenLinksDb();
  const at = Date.now();
  const setStatus = (
    url: string,
    status: number | null,
    checkedAt: number | null,
  ) => {
    db.update(brokenProjectLinks)
      .set({ status, checkedAt })
      .where(eq(brokenProjectLinks.url, url))
      .run();
  };
  setStatus("/projects/1", 404, at);
  setStatus("/projects/2", 200, at);
  setStatus("/projects/3", 404, at - BROKEN_LINK_TTL_MS - 1000);

  const { total, checked, brokenHours, brokenDevlogs, brokenUrls, byCategory } =
    countBrokenLinks([
      { projectId: 1, url: "/projects/1", type: "Web App", hours: 10, devlogs: 4 },
      { projectId: 2, url: "/projects/2", type: "Web App", hours: 20, devlogs: 6 },
      { projectId: 3, url: "/projects/3", type: "CLI", hours: 30, devlogs: 8 },
      { projectId: 9, url: "/projects/9", type: "CLI", hours: 40, devlogs: 10 },
    ]);

  expect(total).toBe(2);
  expect(checked).toBe(3);
  expect(brokenHours).toBe(40);
  expect(brokenDevlogs).toBe(12);
  expect([...brokenUrls].sort()).toEqual(["/projects/1", "/projects/3"]);
  expect(byCategory.get("Web App")).toEqual({
    broken: 1,
    checked: 2,
    brokenHours: 10,
    brokenDevlogs: 4,
  });
  expect(byCategory.get("CLI")).toEqual({
    broken: 1,
    checked: 1,
    brokenHours: 30,
    brokenDevlogs: 8,
  });
});

test("broken counts are null until anything has been checked", () => {
  expect(brokenCountOrNull(5, 0, 0)).toBeNull();
  expect(brokenCountOrNull(5, 2, 3)).toBe(2);
  expect(brokenCountOrNull(5, 0, 3)).toBe(0);
  expect(brokenCountOrNull(0, 0, 0)).toBe(0);
});

test("GoiStats accepts numeric and null brokenLinks", () => {
  const category = {
    type: "Web App",
    count: 2,
    pendingHours: 5,
    pendingDevlogs: 3,
    oldestInQueue: "2026-09-01",
  };
  expect([
    ...Value.Errors(SDTypes["QueueCategoryStats"], {
      ...category,
      brokenLinks: 1,
      brokenHours: 10,
      brokenDevlogs: 4,
      oldestUnbrokenInQueue: "2026-09-01",
    }),
  ]).toHaveLength(0);
  expect([
    ...Value.Errors(SDTypes["QueueCategoryStats"], {
      ...category,
      brokenLinks: null,
      brokenHours: null,
      brokenDevlogs: null,
      oldestUnbrokenInQueue: null,
    }),
  ]).toHaveLength(0);
});

test("oldest unbroken skips broken links", () => {
  const d = (s: string): Date => new Date(s);
  const rows = [
    { url: "/projects/1", type: "Web App", date: d("2026-07-25") },
    { url: "/projects/2", type: "Web App", date: d("2026-08-24") },
    { url: "/projects/3", type: "CLI", date: d("2026-09-04") },
  ];
  const { oldest, byCategory } = selectOldestUnbroken(
    rows,
    new Set(["/projects/1"]),
  );
  expect(oldest).toEqual(d("2026-08-24"));
  expect(byCategory.get("Web App")).toEqual(d("2026-08-24"));
  expect(byCategory.get("CLI")).toEqual(d("2026-09-04"));
});

test("oldest unbroken is null when everything is broken", () => {
  const d = (s: string): Date => new Date(s);
  const rows = [
    { url: "/projects/1", type: "Web App", date: d("2026-07-25") },
    { url: "/projects/2", type: "Web App", date: d("2026-08-24") },
  ];
  const { oldest, byCategory } = selectOldestUnbroken(
    rows,
    new Set(["/projects/1", "/projects/2"]),
  );
  expect(oldest).toBeNull();
  expect(byCategory.size).toBe(0);

  const empty = selectOldestUnbroken([], new Set(["/projects/1"]));
  expect(empty.oldest).toBeNull();
  expect(empty.byCategory.size).toBe(0);
});

test("debug state reflects the sqlite cache", () => {
  const savedCookie = process.env["STARDANCE_AUTH_COOKIE"];
  delete process.env["STARDANCE_AUTH_COOKIE"];
  try {
    const before = getBrokenLinkDebugState();
    expect(before.dbPath).toBe(
      process.env["BROKEN_LINKS_DB_PATH"] as string,
    );
    expect(before.hasCookie).toBe(false);
    expect(before.lastJobAt).toBeNull();

    rememberProjectLinks([
      { projectId: 900, url: "/projects/900", type: "CLI", hours: 5, devlogs: 2 },
      { projectId: 901, url: "/projects/901", type: "CLI", hours: 6, devlogs: 3 },
      { projectId: 902, url: "/projects/902", type: "CLI", hours: 7, devlogs: 4 },
    ]);
    const db = getBrokenLinksDb();
    const at = Date.now();
    db.update(brokenProjectLinks)
      .set({ status: 404, checkedAt: at })
      .where(eq(brokenProjectLinks.url, "/projects/900"))
      .run();
    db.update(brokenProjectLinks)
      .set({ status: 200, checkedAt: at })
      .where(eq(brokenProjectLinks.url, "/projects/901"))
      .run();

    const after = getBrokenLinkDebugState();
    expect(after.linksTotal - before.linksTotal).toBe(3);
    expect(after.linksChecked - before.linksChecked).toBe(2);
    expect(after.linksBroken - before.linksBroken).toBe(1);
    expect(after.linksDue - before.linksDue).toBe(1);
    expect(after.lastDiscoveryCount).toBe(3);
    expect(after.lastDiscoveryAt).not.toBeNull();
  } finally {
    if (savedCookie !== undefined) {
      process.env["STARDANCE_AUTH_COOKIE"] = savedCookie;
    }
  }
});

test("due links are unchecked or older than the TTL", () => {
  const db = getBrokenLinksDb();
  const at = Date.now();
  rememberProjectLinks([
    { projectId: 10, url: "/projects/10", type: "Web App", hours: 1, devlogs: 1 },
    { projectId: 11, url: "/projects/11", type: "Web App", hours: 1, devlogs: 1 },
    { projectId: 12, url: "/projects/12", type: "CLI", hours: 1, devlogs: 1 },
  ]);
  db.update(brokenProjectLinks)
    .set({ status: 200, checkedAt: at })
    .where(eq(brokenProjectLinks.url, "/projects/10"))
    .run();
  db.update(brokenProjectLinks)
    .set({ status: 200, checkedAt: at - BROKEN_LINK_TTL_MS - 1000 })
    .where(eq(brokenProjectLinks.url, "/projects/11"))
    .run();

  const due = getDueLinks(100).map((r) => r.url);
  expect(due).not.toContain("/projects/10");
  expect(due).toContain("/projects/11");
  expect(due).toContain("/projects/12");
});
