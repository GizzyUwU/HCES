import { type Static } from "elysia";
import type { CompatScraperAdapter } from "@server/scrapers/compatibility/adapter";
import { CompatTypes } from "@server/scrapers/compatibility/types";
import Macondo from ".";

export default class MacondoCompat implements CompatScraperAdapter {
  private scraper: Macondo;
  constructor(options: ConstructorParameters<typeof Macondo>[0]) {
    this.scraper = new Macondo(options);
  }

  get lastCode() {
    return this.scraper.lastCode;
  }

  get updatedCookie() {
    return this.scraper.updatedCookie;
  }

  async shop(
    data?: Static<typeof CompatTypes["ShopParams"]>
  ): Promise<Static<typeof CompatTypes["ShopItems"]> | null> {
    if (data?.id) {
      const item = await this.scraper.shopItem({ id: data.id });
      if (!item) return null;
      return [
        {
          id: String(item.id),
          title: item.name ?? "NAME_NOT_SET",
          description: String(item.description ?? ""),
          image: item.image_url ?? null,
          stock: item.stock_remaining ?? null,
          price: item.price_hours ?? item.price_gold ?? 0,
          avgHours: item.price_hours ?? item.price_gold ?? 0,
          regionsEnabled: item.regionsEnabled ?? null,
        },
      ];
    } else {
      const items = await this.scraper.shop();
      if (!items) return null;
      return items.map((item): Static<typeof CompatTypes["ShopItem"]> => ({
        id: String(item.id),
        title: item.name ?? "NAME_NOT_SET",
        description: String(item.description ?? ""),
        image: item.image_url ?? null,
        stock: item.stock_remaining ?? null,
        price: item.price_hours ?? item.price_gold ?? 0,
        avgHours: item.price_hours ?? item.price_gold ?? 0,
        regionsEnabled: item.regionsEnabled ?? null,
      }));
    }
  }

  async devlogs(
    data: Static<typeof CompatTypes["DevlogParams"]>
  ): Promise<Static<typeof CompatTypes["Devlogs"]> | null> {
    if (data.devlogId) {
      const item = await this.scraper.journal({ id: data.id, journalId: data.devlogId });
      if (!item) return null;
      const hours = Math.floor((item.hours ?? 0));
      const minutes = Math.floor(((item.hours ?? 0) % 1) * 60);
      return [
        {
          id: String(item.id),
          description: String(item.long_brief ?? item.short_brief ?? ""),
          posted: String(item.created_at ?? new Date().toISOString()),
          timeLogged: `PT${hours}H${minutes}M0S`,
          mediaUrls: [],
          likes: null,
          comments: null,
        },
      ];
    } else {
      const items = await this.scraper.journals({ id: data.id });
      if (!items) return null;
      return (items as any[]).map((item): Static<typeof CompatTypes["Devlog"]> => {
        const hours = Math.floor((item.hours ?? 0));
        const minutes = Math.floor(((item.hours ?? 0) % 1) * 60);
        return {
          id: String(item.id),
          description: String(item.long_brief ?? item.short_brief ?? ""),
          posted: String(item.created_at ?? new Date().toISOString()),
          timeLogged: `PT${hours}H${minutes}M0S`,
          mediaUrls: [],
          likes: null,
          comments: null,
        };
      });
    }
  }

  async project(
    data: Static<typeof CompatTypes["ProjectParams"]>
  ): Promise<Static<typeof CompatTypes["Project"]> | null> {
    const item = await this.scraper.project({ id: data.id });
    if (!item) return null;
    const journals = await this.scraper.journals({ id: data.id });
    const devlogIds = Array.isArray(journals) ? journals.map((j: any) => String(j.id)) : [];
    let totalDuration: string | null = null;
    if (Array.isArray(journals)) {
      const totalHours = (journals as any[]).reduce((acc: number, j: any) => acc + (Number(j.hours) || 0), 0);
      const h = Math.floor(totalHours);
      const m = Math.floor((totalHours % 1) * 60);
      totalDuration = `PT${h}H${m}M`;
    }
    return {
      id: String(item.id ?? data.id),
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      banner: (item.thumbnail_url as string | null) ?? null,
      maker: null,
      demoUrl: (item.demo_url as string | null) ?? null,
      repoUrl: (item.repository_url as string | null) ?? null,
      readmeUrl: null,
      aiDec: (item.next_ship_ai_usage_description as string | null) ?? null,
      totalDevlogs: devlogIds.length,
      devlogIds,
      totalDuration,
      followers: null,
      createdAt: (item.created_at as string | null) ?? null,
    };
  }
}
