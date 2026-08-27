import { t } from "elysia";
import { Nullable } from "../typeUtils";
export namespace SDTypes {
  export const ShopItem = t.Object({
    title: t.String(),
    description: t.String(),
    avgHours: t.String(),
    price: t.Number({ exclusiveMinimum: -Infinity }),
    stock: Nullable(t.Number()),
    requirements: Nullable(t.String({ description: "Requirements in order to buy the item" }))
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
      rankThisWeek: t.Number(),
      streak: t.Number(),
      bestDay: t.Object({
        devlogCount: t.Number(),
        date: t.String(),
      }),
      allTimeDevlogs: t.Number(),
      devlogsTillMorePay: Nullable(t.Number()),
      currentPay: t.Number(),
      certifiedHours: t.Number(),
      diffPplProjectsReviewed: t.Object({
        rank: t.Number(),
        totalPpl: t.Number(),
      }),
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
      devlogId: t.Optional(t.Number({
        description: "Devlog ID",
      })),
    }),
  ]);
  export const Devlog = t.Object({
    id: t.Number(),
    posted: t.Date(),
    timeLogged: t.String({
      description: "Time of a devlog in ISO 8601 Duration",
    }),
    description: t.String(),
    imageUrls: t.Array(
      t.Object({
        alt: t.String(),
        src: t.String(),
      }),
    ),
    totalComments: t.Number(),
    totalReposts: t.Number(),
    totalLikes: t.Number(),
    totalViews: t.Number(),
  });
  
  export const Project = t.Object({
    name: t.String(),
    description: t.String(),
    banner: t.String(),
    maker: t.Object({
      pfp: t.String(),
      name: t.String(),
    }),
    isSuperStarred: t.Boolean(),
    totalDevlogs: t.Number(),
    totalDuration: t.String({ description: "Total time in ISO 8601 Duration" }),
    followers: t.Number(),
    devlogs: t.Array(Devlog),
  });
}
