import { db, logger } from "@server/lib/utils";
import { apiKeys } from "@server/schema/apiKeys";
import { eq, inArray } from "drizzle-orm";

const columns = {
  id: apiKeys.id,
  createdAt: apiKeys.createdAt,
  userId: apiKeys.userId,
  label: apiKeys.label,
  lastUsed: apiKeys.lastUsed,
} as const;
export type ApiKeyRow = Pick<typeof apiKeys.$inferSelect, keyof typeof columns>;

const cache = new Map<string, { row: ApiKeyRow; expiresAt: number }>();
const hashById = new Map<string, string>();
let pendingLastUsed = new Map<string, Date>();

export async function getApiKey(hash: string): Promise<ApiKeyRow | null> {
  const hit = cache.get(hash);
  if (hit && hit.expiresAt > Date.now()) {
    hit.expiresAt = Date.now() + 60 * 6000;
    pendingLastUsed.set(hit.row.id, new Date());
    return hit.row;
  }

  const [row] = await db
    .select(columns)
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash));
  if (!row) {
    cache.delete(hash);
    return null;
  }

  cache.set(hash, { row, expiresAt: Date.now() + 60 * 6000 });
  hashById.set(row.id, hash);
  return row;
}

export function invalidateApiKey(id: string): void {
  const hash = hashById.get(id);
  if (hash) cache.delete(hash);
  hashById.delete(id);
  pendingLastUsed.delete(id);
}

export function updateCacheApiKey(row: Pick<ApiKeyRow, "id"> & Partial<Omit<ApiKeyRow, "id">>): void {
  const hash = hashById.get(row.id);
  if (!hash) return;
  const entry = cache.get(hash);
  if (entry) entry.row = { ...entry.row, ...row };
}

setInterval(() => {
  if (pendingLastUsed.size === 0) return;
  const batch = [...pendingLastUsed];
  pendingLastUsed = new Map();
  Promise.all(
    batch.map(([id, lastUsed]) =>
      db.update(apiKeys).set({ lastUsed }).where(eq(apiKeys.id, id)),
    ),
  ).catch((err) => logger.error("failed to flush lastUsed batch", { err }));
}, 30 * 1000);

setInterval(async () => {
  const ids = [...hashById.keys()];
  if (ids.length === 0) return;
  const rows = await db
    .select(columns)
    .from(apiKeys)
    .where(inArray(apiKeys.id, ids));
  const fresh = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    const row = fresh.get(id);
    if (!row) {
      void invalidateApiKey(id);
      continue;
    }
    const hash = hashById.get(id);
    if (!hash) continue;
    const entry = cache.get(hash);
    if (entry) entry.row = row;
    continue;
  }
}, (30 * 1000));
