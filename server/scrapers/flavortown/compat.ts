import { type Static } from "elysia";
import type { CompatScraperAdapter } from "@server/scrapers/compatibility/adapter";
import { CompatTypes } from "@server/scrapers/compatibility/types";
import Flavortown from ".";

export default class FlavortownCompat implements CompatScraperAdapter {
  private scraper: Flavortown;
  constructor(options: ConstructorParameters<typeof Flavortown>[0]) {
    this.scraper = new Flavortown(options);
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
    if (data?.id) {
      const item = await this.scraper.shopItem({
        id: Number(data.id),
      });
      if (!item) return null;
      const regionsEnabled = Object.fromEntries(
        Object.entries(item.enabled ?? {})
          .filter(([key]) => key.startsWith("enabled_"))
          .map(([key, value]) => [
            key.slice("enabled_".length).toUpperCase(),
            value ?? false,
          ]),
      );
      return [
        {
          ...item,
          id: String(item.id),
          description: String(item.description),
          image: String(item.image_url),
          stock: item.stock ?? null,
          title: item.name || "NAME_NOT_SET",
          avgHours: (item.ticket_cost?.base_cost ?? 0) * 10,
          price: item.ticket_cost?.base_cost ?? 0,
          regionsEnabled,
        },
      ];
    } else {
      const items = await this.scraper.shop();
      if (!items) return null;
      return items.map((item): Static<(typeof CompatTypes)["ShopItem"]> => ({
        ...item,
        id: String(item.id),
        description: String(item.description),
        image: String(item.image_url),
        stock: item.stock ?? null,
        title: item.name || "NAME_NOT_SET",
        avgHours: (item.ticket_cost?.base_cost ?? 0) * 10,
        price: item.ticket_cost?.base_cost ?? 0,
        regionsEnabled: Object.fromEntries(
          Object.entries(item.enabled ?? {})
            .filter(([key]) => key.startsWith("enabled_"))
            .map(([key, value]) => [
              key.slice("enabled_".length).toUpperCase(),
              value ?? false,
            ]),
        ),
      }));
    }
  }

  async devlogs(
    data: Static<(typeof CompatTypes)["DevlogParams"]>,
  ): Promise<Static<(typeof CompatTypes)["Devlogs"]> | null> {
    if (data.devlogId) {
      const item = await this.scraper.devlog({
        id: Number(data.devlogId),
      });
      if (!item) return null;
      const hours = Math.floor((item.duration_seconds ?? 0) / 3600);
      const minutes = Math.floor(((item.duration_seconds ?? 0) % 3600) / 60);
      const seconds = (item.duration_seconds ?? 0) % 60;

      return [{
        ...item,
        id: String(item.id),
        description: String(item.body),
        posted: String(item.created_at),
        timeLogged: `PT${hours}H${minutes}M${seconds}S`,
        mediaUrls: (item.media ?? []).map((media) => ({
          src: media.url ? "https://flavortown.hackclub.com" + media.url : "",
          alt: "",
        })),
        likes: item.likes_count ?? 0,
        comments: item.comments_count ?? 0,
      }];
    } else {
      const items = await this.scraper.devlogs({
        project_id: Number(data.id),
      });
      if (!items) return null;
      return (items.devlogs ?? []).map(
        (item): Static<(typeof CompatTypes)["Devlog"]> => {
          const hours = Math.floor((item.duration_seconds ?? 0) / 3600);
          const minutes = Math.floor(
            ((item.duration_seconds ?? 0) % 3600) / 60,
          );
          const seconds = (item.duration_seconds ?? 0) % 60;

          return {
            ...item,
            id: String(item.id),
            description: String(item.body),
            posted: String(item.created_at),
            timeLogged: `PT${hours}H${minutes}M${seconds}S`,
            mediaUrls: (item.media ?? []).map((media) => ({
              src: media.url ? "https://flavortown.hackclub.com" + media.url : "",
              alt: "",
            })),
            likes: item.likes_count ?? 0,
            comments: item.comments_count ?? 0,
          };
        },
      );
    }
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
      name: String(item.title),
      description: String(item.description),
      banner: item.banner_url ? "https://flavortown.hackclub.com" + item.banner_url : null,
      maker: null,
      demoUrl: item.demo_url ?? null,
      repoUrl: item.repo_url ?? null,
      readmeUrl: item.readme_url ?? null,
      totalDevlogs: (item.devlog_ids ?? []).length,
      devlogIds: (item.devlog_ids ?? []).map((item) => String(item)),
      totalDuration: null,
      followers: null,
      aiDec: item.ai_declaration ?? null,
      createdAt: null,
    };
  }
}
