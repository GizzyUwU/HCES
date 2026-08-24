import { logger as LogType } from "@server/index.ts";
import { load, type CheerioAPI } from "cheerio";
import { type Static } from "elysia";
import TurndownService from "turndown";
import type { CPScraperAdapter } from "../compatibility/adapter";
import type { CPTypes } from "../compatibility/types";
const parseNum = (text: string): number => Number(text.replace(/,/g, ""));
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

turndown.addRule("stripAnchors", {
  filter: (node) => node.nodeName === "A" && node.classList.contains("anchor"),
  replacement: () => "",
});

turndown.addRule("slackEmoji", {
  filter: (node) =>
    node.nodeName === "IMG" && node.classList.contains("slack-emote"),
  replacement: (_content, node) => {
    const alt = (node as HTMLImageElement)!.getAttribute("alt") ?? "";
    return alt;
  },
});

export default class Stardance implements CPScraperAdapter {
  lastCode: number | null = null;
  private ready: Promise<void>;
  private logger: typeof LogType;
  private keySet: boolean = false;
  private cookie: string = "";
  public updatedCookie: string | undefined;
  static config = {
    baseUrl: "https://stardance.hackclub.com",
  };

  constructor({ logger, cookie }: { logger: typeof LogType; cookie?: string }) {
    this.logger = logger;
    if (cookie) {
      this.keySet = true;
      this.cookie = cookie;
    }
    this.ready = Promise.resolve();
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (this.cookie) headers.set("Cookie", this.cookie);
    const res = await fetch("https://stardance.hackclub.com" + path, {
      ...init,
      headers,
    });
    this.lastCode = res.status;
    for (const cookie of res.headers.getSetCookie()) {
      if (cookie.startsWith("_stardance_session_4=")) {
        this.updatedCookie = cookie.split(";", 1)[0];
      }
    }
    return res;
  }

  async shop(
    category?: string,
  ): Promise<Static<(typeof CPTypes)["ShopItems"]> | null> {
    await this.ready;
    const res = await this.request(
      "/shop" +
        (category && category.length > 0 ? "/" + category : "/category/all"),
    );
    const html = await res.text();
    this.lastCode = res.status;
    if (!(
      typeof html === "string" &&
      (
        String(res.headers.get("content-type")) ??
        String(res.headers.get("Content-Type")) ??
        ""
      ).includes("text/html")
    )) {
      this.logger.warn("Shop endpoint didn't return HTML", {
        contentType: String(res.headers.get("Content-Type")) ?? "",
        status: res.status,
      });
      return null;
    }
    const $ = load(html);
    const shopItems = $(".shop-item-card").toArray();
    const normalizeItems = shopItems.map((bItem) => {
      const item = $(bItem);
      const title = item.find(".shop-item-card__title").text();
      const description = item.find(".shop-item-card__description p").text();
      const avgHours = item.find(".shop-item-card__hours").text();
      const price = item.find(".action-btn .action-btn__label").text();
      return {
        title,
        description,
        avgHours,
        price: Number(price.replace(/[^\d]/g, "")),
      };
    });
    return normalizeItems;
  }

  private async getDevlogs(
    $: CheerioAPI,
    devlogId?: Static<(typeof CPTypes)["DevlogParams"]>["devlogId"]
  ): Promise<Static<(typeof CPTypes)["Project"]>["devlogs"]> {
    const feed = $(".project-show__feed");
    if (!feed.is("section")) return [];
    const devlogs = feed.find(
      '> article[data-feed-engagement-post-type-value="Post::Devlog"]',
    );

    return devlogs
      .map((_, el) => {
        const article = $(el);
        const id = parseNum(
          article.attr("data-feed-engagement-post-id-value") ?? "0",
        );
        if (devlogId && id !== devlogId) return null;
        const durationText = article.find(".feed-post-card__duration").text();
        const hours = Number(durationText.match(/(\d+)h/)?.[1] ?? 0);
        const minutes = Number(durationText.match(/(\d+)m/)?.[1] ?? 0);
        const seconds = Number(durationText.match(/(\d+)s/)?.[1] ?? 0);
        const body = article.find(".feed-post-card__body");
        const imageUrls = article
          .find(".feed-post-card__media-viewport .feed-post-card__image")
          .map((_, img) => {
            const image = $(img);
            return {
              alt: image.attr("alt") ?? "",
              src: image.attr("src") ?? "",
            };
          });

        return {
          id,
          posted: new Date(
            article.find(".feed-post-card__time").attr("datetime") ?? "",
          ),
          timeLogged: `PT${hours}H${minutes}M${seconds}S`,
          description: body.hasClass("markdown-content")
            ? turndown.turndown(body.html() ?? "").trim()
            : body.text().trim(),
          imageUrls: imageUrls.get(),
        };
      })
      .get();
  }

  async project(
    data: Static<(typeof CPTypes)["ProjectParams"]>,
  ): Promise<Static<(typeof CPTypes)["Project"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/projects/" + data.id);
      const html = await res.text();
      this.lastCode = res.status;
      if (!(
        typeof html === "string" &&
        (
          String(res.headers.get("content-type")) ??
          String(res.headers.get("Content-Type")) ??
          ""
        ).includes("text/html")
      )) {
        this.logger.warn("Project endpoint didn't return HTML", {
          contentType:
            String(res.headers.get("Content-Type")) ??
            String(res.headers.get("Content-Type")) ??
            "",
          status: res.status,
          projectId: data.id,
        });
        return null;
      }
      const $ = load(html);
      const projectShowPanel = $(".project-show__panel");
      const name = projectShowPanel.find(".project-show__title").text();
      const description = projectShowPanel
        .find(".project-show__description")
        .text();
      const banner =
        projectShowPanel.find(".project-show__banner-image").attr("src") ??
        "no_image_provided";
      const makerPFP =
        projectShowPanel.find(".project-show__avatar").attr("src") ??
        "no_image_provided";
      const makerName = projectShowPanel.find(".project-show__author").text();
      const totalFollowers = parseNum(
        projectShowPanel.find(".project-show__followers strong").text().trim(),
      );
      let totalDevlogs = 0,
        totalHrsInMinutes = 0;
      projectShowPanel.find(".project-show__stats-item").each((_, el) => {
        const item = $(el);
        const label = item.find(".project-show__stats-label").text().trim();
        const val = parseNum(
          item.find(".project-show__stats-num").text().trim(),
        );
        switch (label) {
          case "Devlogs": {
            totalDevlogs = val;
            break;
          }
          case "Total hours": {
            totalHrsInMinutes = val * 60;
            break;
          }
          default:
            break;
        }
      });
      const totalHours = Math.floor(totalHrsInMinutes / 60);
      const remainingMinutes = totalHrsInMinutes % 60;
      const totalDuration = `PT${totalHours}H${remainingMinutes}M`;
      const devlogs = await this.getDevlogs($);
      return {
        name,
        description,
        banner,
        maker: {
          pfp: makerPFP,
          name: makerName,
        },
        totalDevlogs,
        totalDuration,
        followers: totalFollowers,
        devlogs,
      };
    } catch (err: any) {
      return null;
    }
  }

  
  async devlogs(
    data: Static<(typeof CPTypes)["DevlogParams"]>,
  ): Promise<Static<(typeof CPTypes)["Project"]>["devlogs"] | null> {
    await this.ready;
    try {
      const res = await this.request("/projects/" + data.id);
      const html = await res.text();
      this.lastCode = res.status;
      if (!(
        typeof html === "string" &&
        (
          String(res.headers.get("content-type")) ??
          String(res.headers.get("Content-Type")) ??
          ""
        ).includes("text/html")
      )) {
        this.logger.warn("Project endpoint didn't return HTML trying to get devlogs", {
          contentType:
            String(res.headers.get("Content-Type")) ??
            String(res.headers.get("Content-Type")) ??
            "",
          status: res.status,
          projectId: data.id,
        });
        return null;
      }
      const $ = load(html);
      const devlogs = await this.getDevlogs($, data.devlogId);
      return devlogs;
    } catch (err: any) {
      return null;
    }
  }
}
