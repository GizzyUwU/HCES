import { logger as LogType } from "@server/lib/logger";
import prometheusRegistry from "@server/lib/metrics";
import { MCTypes } from "./types";
import { type Static } from "elysia";
import { Histogram } from "prom-client";

const macondoRequestDuration = new Histogram({
  name: "macondo_request_duration_seconds",
  help: "Duration of requests to Macondo in seconds",
  labelNames: ["path", "status", "worker_id"],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [prometheusRegistry],
});

function expectedPrimitive(schema: unknown): "string" | "number" | "boolean" | null {
  const variants = (schema as any)?.anyOf ?? (schema as any)?.oneOf ?? (schema as any)?.union;
  const list = Array.isArray(variants) ? variants : [schema];
  const types = new Set(
    list.map((v: any) => v?.type).filter((t: unknown) => typeof t === "string" && t !== "null"),
  );
  if (types.size !== 1) return null;
  const only = [...types][0];
  if (only === "integer") return "number";
  return only === "string" || only === "number" || only === "boolean" ? only : null;
}

function coerceToSchema(data: Record<string, unknown>, schema: unknown): Record<string, unknown> {
  const props = (schema as any)?.properties;
  if (!props || typeof props !== "object") return data;
  const out = { ...data };
  for (const [key, propSchema] of Object.entries(props)) {
    const want = expectedPrimitive(propSchema);
    const val: unknown = out[key];
    if (val == null || want == null || typeof val === want) continue;
    if (want === "string" && (typeof val === "number" || typeof val === "boolean")) out[key] = String(val);
    else if (want === "number" && typeof val === "string" && val.trim() !== "" && Number.isFinite(Number(val)))
      out[key] = Number(val);
  }
  return out;
}

export default class Macondo {  lastCode: number | null = null;
  private ready: Promise<void>;
  private logger: typeof LogType;
  private workerId: string | null = null;
  private key: string | null = null;
  private cookie: string | null = null;
  public updatedCookie: string | undefined;
  static config = {
    baseUrl: "https://macondo.hackclub.com",
  };

  constructor({
    logger,
    key,
    cookie,
    workerId,
  }: {
    logger: typeof LogType;
    key?: string;
    cookie?: string;
    workerId?: string;
  }) {
    this.logger = logger;
    this.workerId = workerId ?? null;
    if (key) this.key = key;
    if (cookie) this.cookie = cookie;
    this.ready = Promise.resolve();
  }

  private async request(
    path: string,
    init?: RequestInit & {
      query?: Record<string, unknown>;
    }
  ): Promise<Response> {
    try {
      const headers = new Headers(init?.headers);
      if (this.key) headers.set("Authorization", "Bearer " + this.key);
      if (this.cookie) headers.set("Cookie", this.cookie);
      const before = performance.now();
      const url = new URL(Macondo.config.baseUrl + path);
      if (init?.query) {
        for (const [key, value] of Object.entries(init.query)) {
          if (value !== undefined && value !== null && value !== "")
            url.searchParams.set(key, String(value));
        }
      }
      const res = await fetch(url, {
        ...init,
        headers,
      });
      if (this.workerId) {
        macondoRequestDuration.observe(
          {
            path,
            status: String(res.status),
            worker_id: this.workerId,
          },
          (performance.now() - before) / 1000
        );
      }
      this.lastCode = res.status;
      for (const cookie of res.headers.getSetCookie()) {
        if (cookie.startsWith("macondo_session=") || cookie.startsWith("macondo_rv=")) {
          this.updatedCookie = cookie.split(";", 1)[0];
        }
      }
      return res;
    } catch (err) {
      this.logger.info("Macondo API failed with an error", { error: err });
      throw new Error("Macondo API failed with an error");
    }
  }

  async project(
    params: Static<typeof MCTypes["GetProjectParams"]>
  ): Promise<Static<typeof MCTypes["GetProjectResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/api/projects/" + params.id);
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return data ?? null;

      if (data && typeof data === "object" && !Array.isArray(data)) {
        return coerceToSchema(data as Record<string, unknown>, MCTypes["GetProjectResponse"]);
      }
      return data;
    } catch {
      return null;
    }
  }

  async journals(
    params: Static<typeof MCTypes["JournalsParams"]>
  ): Promise<Static<typeof MCTypes["JournalsResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/api/projects/" + params.id + "/journals");
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return null;
      const coerceJournal = (j: any): any =>
        j && typeof j === "object" && !Array.isArray(j)
          ? coerceToSchema(j as Record<string, unknown>, MCTypes["Journal"])
          : j;
      if (Array.isArray(data)) return data.map(coerceJournal);
      if (Array.isArray((data as any).journals)) return (data as any).journals.map(coerceJournal);
      return data;
    } catch {
      return null;
    }
  }

  async journal(
    params: { id: string; journalId: string }
  ): Promise<Static<typeof MCTypes["Journal"]> | null> {
    await this.ready;
    const all = await this.journals({ id: params.id });
    if (!all) return null;
    return (all as any[]).find((j: any) => String(j.id) === String(params.journalId)) ?? null;
  }

  async shop(): Promise<Static<typeof MCTypes["ShopItems"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/_ui/catalog");
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return null;
      const items = Array.isArray(data) ? data : Array.isArray((data as any).items) ? (data as any).items : [];
      return items.map((item: any): Static<typeof MCTypes["ShopItem"]> => ({
        id: String(item.id ?? item.slug ?? ""),
        slug: item.slug ?? null,
        name: item.name ?? null,
        description: item.description ?? null,
        image_url: item.image_url ?? null,
        price_hours: item.price_hours ?? item.price_gold ?? null,
        price_fruit_type: item.price_fruit_type ?? null,
        price_fruit_amount: item.price_fruit_amount ?? null,
        stock_remaining: item.stock_remaining ?? item.stock ?? null,
        available: item.available ?? null,
        is_purchasable: item.is_purchasable ?? null,
        is_sold_out: item.is_sold_out ?? null,
        category: item.category ?? null,
        kind: item.kind ?? null,
        created_at: item.created_at ?? null,
        updated_at: item.updated_at ?? null,
        price_gold: item.price_gold ?? null,
        regionsEnabled: item.regional_pricing ?? item.regionsEnabled ?? null,
      }));
    } catch {
      return null;
    }
  }

  async shopItem(params: { id: string }): Promise<Static<typeof MCTypes["ShopItem"]> | null> {
    await this.ready;
    const items = await this.shop();
    if (!items) return null;
    return items.find((i) => i.id === params.id || (i as any).slug === params.id) ?? null;
  }

  async orders(): Promise<Static<typeof MCTypes["MyOrders"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/api/shop/my-orders");
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return null;
      const list = Array.isArray(data) ? data : Array.isArray((data as any).orders) ? (data as any).orders : [];
      return (list as any[]).map((entry: any): any => {
        const rawOrder = entry?.order ?? {};
        const rawItem = entry?.item ?? {};
        const rawUser = entry?.orderUser ?? {};
        const normId = (v: unknown) => (v != null ? String(v) : v);
        const order = coerceToSchema(
          { ...rawOrder, id: normId(rawOrder.id), item_id: normId(rawOrder.item_id), user_id: normId(rawOrder.user_id) },
          MCTypes["Order"],
        );
        const item = coerceToSchema({ ...rawItem, id: normId(rawItem.id) }, MCTypes["OrderItem"]);
        const orderUser = coerceToSchema({ ...rawUser, id: normId(rawUser.id) }, MCTypes["OrderUser"]);
        return { order, item, orderUser, fulfillable: entry?.fulfillable ?? null };
      });
    } catch {
      return null;
    }
  }

  async og(params: Static<typeof MCTypes["OgParams"]>): Promise<Static<typeof MCTypes["OgResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/api/projects/" + params.id + "/og");
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return null;
      return data;
    } catch {
      return null;
    }
  }

  async hackatimeBreakdown(params: { id: string }): Promise<Static<typeof MCTypes["HackatimeBreakdownResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/api/projects/" + params.id + "/hackatime-breakdown");
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return null;
      return data;
    } catch {
      return null;
    }
  }

  async user(params: Static<typeof MCTypes["GetUserParams"]>): Promise<Static<typeof MCTypes["GetUserResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/api/users/" + params.id);
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return null;
      return data;
    } catch {
      return null;
    }
  }

  async streaks(): Promise<Static<typeof MCTypes["StreaksResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/api/profile/streaks");
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return null;
      return data;
    } catch {
      return null;
    }
  }

  async balance(): Promise<Static<typeof MCTypes["BalanceResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/api/users/balance");
      const data = await res.json();
      this.lastCode = res.status;
      if (!res.ok) return null;
      return data;
    } catch {
      return null;
    }
  }
}
