import { type Static } from "elysia";
import type { CompatScraperAdapter } from "@server/scrapers/compatibility/adapter";
import { CompatTypes } from "@server/scrapers/compatibility/types";
import Stardance from ".";

export default class StardanceCompat implements CompatScraperAdapter {
  private scraper: Stardance;
  constructor(options: ConstructorParameters<typeof Stardance>[0]) {
    this.scraper = new Stardance(options);
  }

  get lastCode() {
    return this.scraper.lastCode;
  }

  get updatedCookie() {
    return this.scraper.updatedCookie;
  }

  async shop(
    data?: Static<(typeof CompatTypes)["ShopParams"]>,
  ): Promise<Static<(typeof CompatTypes)["ShopItems"]> | null> {
    const items = await this.scraper.shop({
      id: data?.id ? Number(data.id) : undefined,
    });
    if (!items) return null;
    return items.map((item): Static<(typeof CompatTypes)["ShopItem"]> => ({
      ...item,
      id: String(item.id)
    }));
  }

  async devlogs(
    data: Static<(typeof CompatTypes)["DevlogParams"]>,
  ): Promise<Static<(typeof CompatTypes)["Devlogs"]> | null> {
    const items = await this.scraper.devlogs({
      id: Number(data.id),
      devlogId: Number(data.devlogId),
    });
    if (!items) return null;
    return items.map((item): Static<(typeof CompatTypes)["Devlog"]> => ({
      ...item,
      id: String(item.id),
      posted: item.posted.toISOString()
    }));
  }

  async project(
    data: Static<(typeof CompatTypes)["ProjectParams"]>,
  ): Promise<Static<(typeof CompatTypes)["Project"]> | null> {
    const item = await this.scraper.project({
      id: Number(data.id),
    });
    if (!item) return null;
    return {
      ...item,
      id: String(item.id),
      devlogIds: item.devlogs.map((item) => String(item.id)),
      aiDec: null,
      createdAt: null,
    };
  }
}
