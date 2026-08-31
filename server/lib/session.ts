// lib/session.ts
import { db } from "@server/lib/utils"
import tables  from '@server/schema/index'
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Context } from "elysia";

type SessionRow = {
  id: string;
  userId: string | null;
  oauthState: string | null;
  expiresAt: Date;
  createdAt: Date;
}

const sessionCache = new WeakMap<Context["cookie"], Promise<SessionRow>>();
export function invalidateSession(cookie: Context["cookie"]) {
  sessionCache.delete(cookie)
}

export function getOrCreateSession(cookie: Context["cookie"]): Promise<SessionRow> {
  const cached = sessionCache.get(cookie);
  if (cached) return cached;
  const promise = resolveSession(cookie).catch((err) => {
    sessionCache.delete(cookie);
    throw err;
  });
  sessionCache.set(cookie, promise);
  return promise;
}

export async function resolveSession(cookie: Context["cookie"]): Promise<SessionRow> {
  const existingId = cookie["sid"]?.value as string | undefined;
  if (existingId) {
    const [existing] = await db.select().from(tables.session).where(eq(tables.session.id, existingId));
    if (existing && existing.expiresAt > new Date()) return existing;
  }

  const id = createId();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.insert(tables.session).values({ id, expiresAt });

  cookie["sid"]!.set({
    value: id,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return { id, userId: null as string | null, oauthState: null as string | null, expiresAt, createdAt: new Date() };
}