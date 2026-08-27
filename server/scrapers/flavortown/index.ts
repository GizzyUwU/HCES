import { logger as LogType } from "@server/index.ts";
import prometheusRegistry from "@server/lib/metrics";
import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { FTTypes } from "./types";
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

const flavortownRequestDuration = new Histogram({
  name: "flavortown_request_duration_seconds",
  help: "Duration of requests to Flavortown in seconds",
  labelNames: ["path", "status", "worker_id"],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [prometheusRegistry],
});

export default class Flavortown {
  lastCode: number | null = null;
  private ready: Promise<void>;
  private logger: typeof LogType;
  private keySet: boolean = false;
  private workerId: string | null = null;
  private key: string = "";
  public updatedCookie: string | undefined;
  static config = {
    baseUrl: "https://flavortown.hackclub.com",
  };

  constructor({
    logger,
    key,
    workerId,
  }: {
    logger: typeof LogType;
    key: string;
    workerId?: string;
  }) {
    this.logger = logger;
    this.workerId = workerId ?? null;
    this.keySet = true;
    this.key = key;
    this.ready = Promise.resolve();
  }

  private async request(
    path: string,
    init?: RequestInit & {
      query?: Record<string, unknown>;
    },
  ): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set("X-Flavortown-Ext-1865", "true");
    headers.set("Authorization", "Bearer " + this.key);
    const before = performance.now();
    const url = new URL(Flavortown.config.baseUrl + "/api/v1" + path);
    if (init?.query) {
      for (const [key, value] of Object.entries(init.query)) {
        if (value && value !== null) [url.searchParams.set(key, String(value))];
      }
    }

    const res = await fetch(url, {
      ...init,
      headers,
    });
    if (this.workerId) {
      flavortownRequestDuration.observe(
        {
          path,
          status: String(res.status),
          worker_id: this.workerId,
        },
        (performance.now() - before) / 1000,
      );
    }
    this.lastCode = res.status;
    return res;
  }

  async shop(): Promise<Static<
    (typeof FTTypes)["ListStoreItemsResponse"]
  > | null> {
    await this.ready;
    const res = await this.request("/store");
    const data = await res.json();
    this.lastCode = res.status;
    return data;
  }

  async shopItem(
    data: Static<(typeof FTTypes)["GetStoreItemParams"]>,
  ): Promise<Static<(typeof FTTypes)["GetStoreItemResponse"]> | null> {
    await this.ready;
    const res = await this.request("/store/" + data.id);
    const resData = await res.json();
    this.lastCode = res.status;
    return resData;
  }

  async project(
    data: Static<(typeof FTTypes)["GetProjectParams"]>,
  ): Promise<Static<(typeof FTTypes)["GetProjectResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/projects/" + data.id);
      const resData = await res.json();
      this.lastCode = resData.status;
      return data;
    } catch (err: any) {
      return null;
    }
  }

  async allDevlogs(
    data: Static<(typeof FTTypes)["ListDevlogsQueryParams"]>,
  ): Promise<Static<(typeof FTTypes)["ListDevlogsResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/devlogs", {
        query: data,
      });
      const resData = await res.json();
      this.lastCode = res.status;
      return resData;
    } catch (err: any) {
      return null;
    }
  }

  async devlogs(
    data: Static<(typeof FTTypes)["ListProjectDevlogsParams"]>,
    query: Static<(typeof FTTypes)["ListProjectDevlogsQueryParams"]>,
  ): Promise<Static<(typeof FTTypes)["ListDevlogsResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request(
        "/projects/" + data.project_id + "/devlogs",
        {
          query,
        },
      );
      const resData = await res.json();
      this.lastCode = res.status;
      return resData;
    } catch (err: any) {
      return null;
    }
  }

  async devlog(
    data: Static<(typeof FTTypes)["GetDevlogParams"]>,
  ): Promise<Static<(typeof FTTypes)["ListDevlogsResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/devlogs/" + data.id, {
        query: data,
      });
      const resData = await res.json();
      this.lastCode = res.status;
      return resData;
    } catch (err: any) {
      return null;
    }
  }

  async users(
    query?: Static<(typeof FTTypes)["ListUsersQueryParams"]>,
  ): Promise<Static<(typeof FTTypes)["ListUsersResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/users", {
        query,
      });
      const resData = await res.json();
      this.lastCode = res.status;
      return resData;
    } catch (err: any) {
      return null;
    }
  }

  async user(
    data: Static<(typeof FTTypes)["GetUserParams"]>,
  ): Promise<Static<(typeof FTTypes)["GetUserResponse"]> | null> {
    await this.ready;
    try {
      const res = await this.request("/users/" + data.id);
      const resData = await res.json();
      this.lastCode = res.status;
      return resData;
    } catch (err: any) {
      return null;
    }
  }
}
