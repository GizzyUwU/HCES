import { type Static } from "elysia";
import type { CPScraperAdapter } from "@server/scrapers/compatibility/adapter";
import { CPTypes } from "@server/scrapers/compatibility/types";
import Stardance from ".";

export default class StardanceCP implements CPScraperAdapter {
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
    data?: Static<(typeof CPTypes)["ShopParams"]>,
  ): Promise<Static<(typeof CPTypes)["ShopItems"]> | null> {
    const items = await this.scraper.shop({
      id: data?.id ? Number(data.id) : undefined,
    });
    if (!items) return null;
    return items.map((item): Static<(typeof CPTypes)["ShopItem"]> => ({
      ...item,
      id: String(item.id)
    }));
  }

  async devlogs(
    data: Static<(typeof CPTypes)["DevlogParams"]>,
  ): Promise<Static<(typeof CPTypes)["Devlogs"]> | null> {
    const items = await this.scraper.devlogs({
      id: Number(data.id),
      devlogId: Number(data.devlogId),
    });
    if (!items) return null;
    return items.map((item): Static<(typeof CPTypes)["Devlog"]> => ({
      ...item,
      id: String(item.id),
      posted: item.posted.toISOString()
    }));
  }

  async project(
    data: Static<(typeof CPTypes)["ProjectParams"]>,
  ): Promise<Static<(typeof CPTypes)["Project"]> | null> {
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
