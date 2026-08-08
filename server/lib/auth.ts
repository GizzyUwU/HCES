// lib/auth.ts
import oauth2 from "@bogeychan/elysia-oauth2";
import type {
  TOAuth2Provider,
  TOAuth2AccessToken,
} from "@bogeychan/elysia-oauth2";
import { db } from "@server/index";
import { session, oauthToken, users } from "@server/schema/users";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getOrCreateSession } from "@server/lib/session";
import { UnverifiedAccountError } from "@server/lib/error";

function hackClubAuth(): TOAuth2Provider {
  if (!process.env["HCA_CLIENT_ID"] || !process.env["HCA_CLIENT_SECRET"])
    throw new Error(
      "HCA Client ID/Secret Environment Variables need to be set",
    );
  return {
    clientId: process.env["HCA_CLIENT_ID"] ?? "",
    clientSecret: process.env["HCA_CLIENT_SECRET"] ?? "",
    auth: {
      url: "https://auth.hackclub.com/oauth/authorize",
      params: { allow_signup: true },
    },
    token: {
      url: "https://auth.hackclub.com/oauth/token",
      params: {},
    },
  };
}

function isTokenValid(token?: TOAuth2AccessToken): boolean {
  if (!token) return false;
  const now = Date.now() / 1000;
  return now < token.created_at + token.expires_in;
}

async function resolveOrCreateUser(token: TOAuth2AccessToken) {
  const res = await fetch("https://auth.hackclub.com/api/v1/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch HCA identity: ${res.status}`);
  const me = (await res.json()) as {
    identity: {
      id: string;
      ysws_eligible: boolean;
      verification_status: string;
      slack_id: string;
    };
  };
  if (me.identity.verification_status !== "verified" || !me.identity.ysws_eligible) throw new UnverifiedAccountError();

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.hcaId, me.identity.id));
  if (existing && existing.slackId !== me.identity.slack_id) {
    await db
      .update(users)
      .set({ slackId: me.identity.slack_id })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(users)
    .values({
      slackId: me.identity.slack_id,
      hcaId: me.identity.id
    })
    .returning();
  return created!.id;
}

export const auth = oauth2({
  profiles: {
    hackclub: {
      provider: hackClubAuth(),
      scope: ["verification_status", "slack_id"],
    },
  },
  host: process.env["APP_HOST"] ?? "localhost:8000",
  redirectTo: `${process.env["WEB_URL"] ?? "http://localhost:3000"}/dashboard`,
  state: {
    async check({ cookie }, _, state) {
      const s = await getOrCreateSession(cookie);
      return s.oauthState !== null && state === s.oauthState && s.expiresAt > new Date();
    },
    async generate({ cookie }) {
      const s = await getOrCreateSession(cookie);
      const nonce = createId();
      await db
        .update(session)
        .set({ oauthState: nonce })
        .where(eq(session.id, s.id));
      return nonce;
    },
  },
  storage: {
    async get({ cookie }, name) {
      const s = await getOrCreateSession(cookie);
      if (!s.userId) return undefined;
      const [tok] = await db
        .select()
        .from(oauthToken)
        .where(
          and(eq(oauthToken.userId, s.userId), eq(oauthToken.provider, name)),
        );
      return tok?.token;
    },
    async set({ cookie }, name, token) {
      const s = await getOrCreateSession(cookie);

      let userId = s.userId;
      if (userId) {
        const [existingTok] = await db
          .select()
          .from(oauthToken)
          .where(
            and(eq(oauthToken.userId, userId), eq(oauthToken.provider, name)),
          );
        if (!isTokenValid(existingTok?.token)) {
          userId = await resolveOrCreateUser(token);
        }
      } else {
        userId = await resolveOrCreateUser(token);
      }

      await db
        .insert(oauthToken)
        .values({ userId, provider: name, token })
        .onConflictDoUpdate({
          target: [oauthToken.userId, oauthToken.provider],
          set: { token },
        });

      if (!s.userId) {
        await db.update(session).set({ userId }).where(eq(session.id, s.id));
      }

    },
    async delete({
      cookie
    }, name) {
      const s = await getOrCreateSession(cookie);
      if (!s.userId) return;
      await db
        .delete(oauthToken)
        .where(
          and(eq(oauthToken.userId, s.userId), eq(oauthToken.provider, name)),
        );
    },
  },
});
