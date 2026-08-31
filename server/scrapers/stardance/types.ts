import { t } from "elysia";
import { Duration, Nullable } from "@server/scrapers/typeUtils";
export namespace SDTypes {
  export const ShopParams = t.Object({
    id: t.Optional(t.Number({
      description: "Item ID",
    })),
    category: t.Optional(t.String({
      description: "Category to look at"
    }))
  });
  export const ShopItem = t.Object({
    id: t.Number(),
    title: t.String(),
    image: t.String({
      format: "uri",
    }),
    description: t.String(),
    avgHours: t.Number({
      minimum: 0
    }),
    price: t.Number({ exclusiveMinimum: -Infinity }),
    stock: Nullable(t.Number()),
    requirements: Nullable(
      t.String({ description: "Requirements in order to buy the item" }),
    ),
    regionsEnabled: Nullable(t.Record(t.String(), t.Boolean())),
  });
  export const ShopItems = t.Array(ShopItem);

  export const GoiStats = t.Object({
    myUsername: t.String(),
    reviewerLb: t.Array(
      t.Object({
        reviewer: t.String(),
        devlogsLastThreeDays: t.Number(),
        lockedInStatus: t.Boolean(),
        lockedInQuota: t.Number(),
        projectsReviewedLastThreeDays: t.Number(),
        stardustEarnt: t.Number(),
      }),
    ),
    graph: t.Object({
      dates: t.Array(t.String()),
      reviewers: t.Array(
        t.Object({
          reviewer: t.String(),
          reviews: t.Number(),
        }),
      ),
    }),
    devlogsPerDayThisWeek: t.Number(),
    numberNeededToTodaysGoal: Nullable(t.Number()),
    personalStats: t.Object({
      shareThisWeek: t.Number(),
      rankThisWeek: t.Object({
        rank: t.Number(),
        totalPpl: t.Number()
      }),
      streak: t.Number(),
      bestDay: t.Object({
        devlogCount: t.Number(),
        date: t.String(),
      }),
      allTimeDevlogs: t.Number(),
      devlogsTillMorePay: Nullable(t.Number()),
      currentPay: t.Number(),
      certifiedHours: t.Number(),
      diffPplProjectsReviewed: t.Number()
    }),
  });

  export const ProjectParams = t.Object({
    id: t.Number({
      description: "Project ID",
    }),
  });
  export const DevlogParams = t.Composite([
    ProjectParams,
    t.Object({
      devlogId: t.Optional(
        t.Number({
          description: "Devlog ID",
        }),
      ),
    }),
  ]);
  export const Devlog = t.Object({
    id: t.Number(),
    posted: t.Date(),
    timeLogged: t.String({
      description: "Time of a devlog in ISO 8601 Duration",
    }),
    description: t.String(),
    mediaUrls: t.Array(
      t.Object({
        alt: t.String(),
        src: t.String(),
      }),
    ),
    comments: t.Number(),
    reposts: t.Number(),
    likes: t.Number(),
    views: t.Number(),
  });

  export const Project = t.Object({
    id: t.Number(),
    name: t.String(),
    description: t.String(),
    banner: t.String(),
    maker: t.Object({
      pfp: t.String(),
      name: t.String(),
    }),
    demoUrl: Nullable(
      t.String({
        format: "uri",
      }),
    ),
    repoUrl: Nullable(
      t.String({
        format: "uri",
      }),
    ),
    readmeUrl: Nullable(
      t.String({
        format: "uri",
      }),
    ),
    isSuperStarred: t.Boolean(),
    totalDevlogs: t.Number(),
    totalDuration: t.String({
      description: "Total time in ISO 8601 duration format",
      pattern: Duration,
    }),
    followers: t.Number(),
    devlogs: t.Array(Devlog),
  });
}
