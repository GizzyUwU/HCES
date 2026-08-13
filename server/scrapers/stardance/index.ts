import axios, { type AxiosInstance } from "axios";
import { logger as LogType } from "@server/index.ts";
import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { SDTypes } from "./types";
import t from "typebox";

export default class Stardance {
  lastCode: number | null = null;
  private fetch: AxiosInstance;
  private ready: Promise<void>;
  private logger: typeof LogType;
  private keySet: boolean = false;

  constructor({ logger, cookie }: { logger: typeof LogType; cookie?: string }) {
    this.logger = logger;
    this.fetch = axios.create({
      baseURL: "https://stardance.hackclub.com",
      headers: cookie ? { Cookie: cookie } : undefined,
    });
    if (cookie) this.keySet = true;
    this.ready = Promise.resolve();
  }

  async shop(
    category?: string,
  ): Promise<t.Static<(typeof SDTypes)["shopItems"]> | null> {
    await this.ready;
    const res = await this.fetch.request({
      method: "GET",
      url:
        "/shop" +
        (category && category.length > 0 ? "/" + category : "/category/all"),
    });
    this.lastCode = res.status;
    if (!(
      typeof res.data === "string" &&
      (
        String(res.headers["content-type"]) ??
        String(res.headers["Content-Type"]) ??
        ""
      ).includes("text/html")
    )) {
      this.logger.warn("Shop endpoint didn't return HTML", {
        contentType: String(res.headers["Content-Type"]) ?? "",
        status: res.status,
      });
      return null;
    }
    const $ = load(res.data);
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

  private async goiReviewerLb($: CheerioAPI, rows: Element[]): Promise<t.Static<(typeof SDTypes)["goiStats"]>["reviewerLb"]> {
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

  private async goiReviewerGraph($: CheerioAPI): Promise<t.Static<(typeof SDTypes)["goiStats"]>["graph"]> {
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
  ): Promise<t.Static<(typeof SDTypes)["goiStats"]>["personalStats"]> {
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
          certifiedHours = Number(value);
          break;
        case "People's projects you've reviewed":
          diffPplProjectsReviewed.rank = Number(value);
          diffPplProjectsReviewed.totalPpl = Number(
            note.match(/\d+/)?.[0] ?? 0,
          );
          break;
        case "Day streak":
          streak = Number(value);
          break;
        case "Best day": {
          bestDay.devlogCount = Number(value);
          const date = note.match(/set (\S+)/);
          bestDay.date = String(date ? date[1] : "");
          break;
        }
        case "Share this week":
          shareThisWeek = Number(value.replace(/%/g, ""));
          break;
        case "Rank this week":
          rankThisWeek = Number(value.replace(/^#/, ""));
          break;
        default:
          break;
      }
    }

    const tierNote = $(".ysws-dashboard__progress-tier-note").text();
    const allTimeDevlogs = Number(
      $(".ysws-dashboard__progress-tier-note strong").text(),
    );
    const devlogsTillMorePayMatch = tierNote.match(/(\d+)\s+mores?/);
    const devlogsTillMorePay = devlogsTillMorePayMatch
      ? Number(devlogsTillMorePayMatch[1])
      : null;

    const currentPayMatch = tierNote.match(/up from ([\d.]+)/);
    const currentPay = currentPayMatch ? Number(currentPayMatch[1]) : 0;
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

  async goiStats(): Promise<
    t.Static<(typeof SDTypes)["goiStats"]> | null
  > {
    await this.ready;
    if (!this.keySet) throw new Error("This requires a cookie to be provided");
    const res = await this.fetch.request({
      method: "GET",
      url: "/admin/certification/review/dashboard",
    });
    this.lastCode = res.status;
    if (!(
      typeof res.data === "string" &&
      (
        String(res.headers["content-type"]) ??
        String(res.headers["Content-Type"]) ??
        ""
      ).includes("text/html")
    )) {
      this.logger.warn("GOI Stats endpoint didn't return HTML", {
        contentType: String(res.headers["Content-Type"]) ?? "",
        status: res.status,
      });
      return null;
    }
    const $ = load(res.data);
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
    const myUsername = $(".sidebar__user-meta-handle").text().replace(/\s+/g, " ").trim().replace(/^@/, "");
    return {
      myUsername,
      reviewerLb,
      graph,
      devlogsPerDayThisWeek,
      numberNeededToTodaysGoal: goalMatch ? Number(goalMatch[0]) : null,
      personalStats
    };
  }
}
