// lib/session.ts
import { db } from "../index"
import tables  from '../schema/index'
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Context } from "elysia";

export async function getOrCreateSession(cookie: Context["cookie"]) {
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