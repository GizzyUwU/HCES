import { logger as LogType } from "@server/index.ts";
import prometheusRegistry from "@server/lib/metrics";
import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { SDTypes } from "./types";
import { type Static } from "elysia";
import TurndownService from "turndown";
import { Histogram } from "prom-client";
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

const stardanceRequestDuration = new Histogram({
  name: "stardance_request_duration_seconds",
  help: "Duration of requests to Stardance in seconds",
  labelNames: ["path", "status", "worker_id"],
  buckets: [
    0.01,
    0.025,
    0.05,
    0.1,
    0.25,
    0.5,
    1,
    2.5,
    5,
    10,
    30,
  ],
  registers: [prometheusRegistry],
});

export default class Stardance {
  lastCode: number | null = null;
  private ready: Promise<void>;
  private logger: typeof LogType;
  private keySet: boolean = false;
  private workerId: string | null = null;
  private cookie: string = "";
  public updatedCookie: string | undefined;
  static config = {
    baseUrl: "https://stardance.hackclub.com",
  };

  constructor({ logger, cookie, workerId }: { logger: typeof LogType; cookie?: string; workerId?: string }) {
    this.logger = logger;
    this.workerId = workerId ?? null;
    if (cookie) {
      this.keySet = true;
      this.cookie = cookie;
    }
    this.ready = Promise.resolve();
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (this.cookie) headers.set("Cookie", this.cookie);
    const before = performance.now()
    const res = await fetch("https://stardance.hackclub.com" + path, {
      ...init,
      headers,
    });
    if (this.workerId) {
      console.log("aaaaa")
      stardanceRequestDuration.observe(
        {
          path,
          status: String(res.status),
          worker_id: this.workerId
        },
        (performance.now() - before) / 1000,
      );
    }
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
  ): Promise<Static<(typeof SDTypes)["ShopItems"]> | null> {
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

  private async goiReviewerLb(
    $: CheerioAPI,
    rows: Element[],
  ): Promise<Static<(typeof SDTypes)["GoiStats"]>["reviewerLb"]> {
    return rows.map((bRow) => {
      const row = $(bRow);
      const cells = row.find("td");
      const reviewer = cells.eq(1).find("a").text();
      const devlogsLastThreeDays = Number(cells.eq(2).text());
      const lockedInQuota = Number(
        cells.eq(3).text().replace(/\s+/g, " ").trim(),
      );
      const projectsReviewedLastThreeDays = Number(cells.eq(4).text());
      const stardustEarnt = Number(cells.eq(5).text());
      const lockedInStatus = row.hasClass("ysws-dashboard__row--on-pace");
      return {
        reviewer,
        devlogsLastThreeDays,
        lockedInStatus,
        lockedInQuota,
        projectsReviewedLastThreeDays,
        stardustEarnt,
      };
    });
  }

  private async goiReviewerGraph(
    $: CheerioAPI,
  ): Promise<Static<(typeof SDTypes)["GoiStats"]>["graph"]> {
    const graph = $(".ysws-dashboard__chart");
    const rawGraph = graph.attr(
      "data-certification--ysws--reviewer-chart-chart-value",
    );
    if (!rawGraph) {
      this.logger.warn("GOI reviewer chart data attribute is missing.");
      return { dates: [], reviewers: [] };
    }

    let parsed: {
      labels: string[];
      series: {
        name: string;
        data: number[];
      }[];
    };

    try {
      parsed = JSON.parse(rawGraph);
    } catch (err) {
      this.logger.warn("GOI reviewer chart data failed to parse", {
        error: err,
      });
      return { dates: [], reviewers: [] };
    }

    const dates = parsed.labels ?? [];
    const reviewers = (parsed.series ?? []).map((s) => ({
      reviewer: s.name,
      reviews: s.data.reduce((sum, n) => sum + n, 0),
    }));

    return {
      dates,
      reviewers,
    };
  }

  private async goiPersonalStats(
    $: CheerioAPI,
  ): Promise<Static<(typeof SDTypes)["GoiStats"]>["personalStats"]> {
    const container = $(".ysws-dashboard__progress-stats");
    const stats = container.find(".ysws-dashboard__progress-stat").toArray();
    let certifiedHours = 0,
      streak = 0,
      shareThisWeek = 0,
      rankThisWeek = 0;

    let bestDay: {
      devlogCount: number;
      date: string;
    } = {
      devlogCount: 0,
      date: "",
    };

    let diffPplProjectsReviewed: {
      rank: number;
      totalPpl: number;
    } = {
      rank: 0,
      totalPpl: 0,
    };

    for (const bStat of stats) {
      const stat = $(bStat);
      const label = stat.find(".ysws-dashboard__progress-stat-label").text();
      const value = stat.find(".ysws-dashboard__progress-stat-value").text();
      const note = stat.find(".ysws-dashboard__progress-stat-note").text();
      switch (label) {
        case "Hours certified":
          certifiedHours = parseNum(value);
          break;
        case "People's projects you've reviewed":
          diffPplProjectsReviewed.rank = parseNum(value);
          diffPplProjectsReviewed.totalPpl = Number(
            note.replace(/,/g, "").match(/\d+/)?.[0] ?? 0,
          );
          break;
        case "Day streak":
          streak = parseNum(value);
          break;
        case "Best day": {
          bestDay.devlogCount = parseNum(value);
          const date = note.match(/set (\S+)/);
          bestDay.date = String(date ? date[1] : "");
          break;
        }
        case "Share this week":
          shareThisWeek = parseNum(value.replace(/%/g, ""));
          break;
        case "Rank this week":
          rankThisWeek = parseNum(value.replace(/^#/, ""));
          break;
        default:
          break;
      }
    }

    const tierNote = $(".ysws-dashboard__progress-tier-note").text();
    const allTimeDevlogs = parseNum(
      $(".ysws-dashboard__progress-tier-note strong").text(),
    );
    const devlogsTillMorePayMatch = tierNote.match(/(\d+)\s+mores?/);
    const devlogsTillMorePay = devlogsTillMorePayMatch
      ? parseNum(String(devlogsTillMorePayMatch[1]))
      : null;

    const currentPayMatch = tierNote.match(/up from ([\d.]+)/);
    const currentPay = currentPayMatch
      ? parseNum(String(currentPayMatch[1]))
      : 0;
    return {
      certifiedHours,
      diffPplProjectsReviewed,
      streak,
      bestDay,
      shareThisWeek,
      rankThisWeek,
      allTimeDevlogs,
      devlogsTillMorePay,
      currentPay,
    };
  }

  async goiStats(): Promise<Static<(typeof SDTypes)["GoiStats"]> | null> {
    await this.ready;
    if (!this.keySet) throw new Error("This requires a cookie to be provided");
    const start = performance.now();
    try {
      const res = await this.request("/admin/certification/review/dashboard");
      const html = await res.text();
      const received = performance.now();
      this.lastCode = res.status;
      if (!(
        typeof html === "string" &&
        (
          String(res.headers.get("content-type")) ??
          String(res.headers.get("Content-Type")) ??
          ""
        ).includes("text/html")
      )) {
        this.logger.warn("GOI Stats endpoint didn't return HTML", {
          contentType:
            String(res.headers.get("Content-Type")) ??
            String(res.headers.get("content-type")) ??
            "",
          status: res.status,
        });
        return null;
      }
      const $ = load(html);
      const lbRows = $(".ysws-dashboard__table tbody tr").toArray();
      const reviewerLb = await this.goiReviewerLb($, lbRows);
      const graph = await this.goiReviewerGraph($);
      const hero = $(".ysws-dashboard__progress-hero");
      const devlogsPerDayThisWeek = Number(
        hero.find(".ysws-dashboard__progress-count").text(),
      );
      const goalMatch = hero
        .find(".ysws-dashboard__progress-note")
        .text()
        .trim()
        .match(/\d+/);
      const personalStats = await this.goiPersonalStats($);
      const myUsername = $(".sidebar__user-meta-handle")
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^@/, "");
      const parsed = performance.now();
      console.log({
        request: `${(received - start).toFixed(2)}ms`,
        parse: `${(parsed - received).toFixed(2)}ms`,
        total: `${(parsed - start).toFixed(2)}ms`,
        bytes: html.length,
      });
      return {
        myUsername,
        reviewerLb,
        graph,
        devlogsPerDayThisWeek,
        numberNeededToTodaysGoal: goalMatch ? Number(goalMatch[0]) : null,
        personalStats,
      };
    } catch (err: any) {
      return null;
    }
  }

  private async getDevlogs(
    $: CheerioAPI,
    devlogId?: Static<(typeof SDTypes)["DevlogParams"]>["devlogId"]
  ): Promise<Static<(typeof SDTypes)["Project"]>["devlogs"]> {
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
        let totalComments = 0,
          totalReposts = 0,
          totalLikes = 0,
          totalViews = 0;
        for (const bEl of article
          .find(".feed-post-card__actions")
          .children()
          .toArray()) {
          const action = $(bEl);
          switch (true) {
            case action.hasClass("feed-post-card__comment-action"):
              totalComments = parseNum(
                action.find("span[id^='comments_count_']").text(),
              );
              break;
            case action.hasClass("feed-post-card__repost"):
              totalReposts = parseNum(
                action.find("summary span").first().text(),
              );
              break;
            case action.hasClass("feed-post-card__like"):
              totalLikes = parseNum(action.find(".like-button__count").text());
              break;
            case (action.attr("aria-label") ?? "").startsWith("Seen by"):
              totalViews = parseNum(action.find("span").last().text());
              break;
            default:
              break;
          }
        }
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
          totalComments,
          totalReposts,
          totalLikes,
          totalViews,
        };
      })
      .get();
  }

  async project(
    data: Static<(typeof SDTypes)["ProjectParams"]>,
  ): Promise<Static<(typeof SDTypes)["Project"]> | null> {
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
      const superStarBadge = projectShowPanel
        .find(".project-show__badge.project-show__badge--fire")
        .text();
      const isSuperStarred =
        superStarBadge && superStarBadge.includes("⭐ Super Star Project")
          ? true
          : false;
      const devlogs = await this.getDevlogs($);
      return {
        name,
        description,
        banner,
        maker: {
          pfp: makerPFP,
          name: makerName,
        },
        isSuperStarred,
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
    data: Static<(typeof SDTypes)["DevlogParams"]>,
  ): Promise<Static<(typeof SDTypes)["Project"]>["devlogs"] | null> {
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
