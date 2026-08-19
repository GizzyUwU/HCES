import { t, type TSchema } from "elysia";
import { TypeCompiler } from "elysia/type-system";
export const Nullable = <T extends TSchema>(schema: T) => {
  const union = t.Union([t.Null(), schema]);
  return Object.assign({}, union, TypeCompiler.Compile(union)) as typeof union;
};

export namespace SDTypes {
  export const shopItems = t.Array(
    t.Object({
      title: t.String(),
      description: t.String(),
      avgHours: t.String(),
      price: t.Number({ exclusiveMinimum: -Infinity }),
    }),
  );

  export const goiStats = t.Object({
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

  export const projectParams = t.Object({
    id: t.Number({
      description: "Project ID"
    })
  })
  export const project = t.Object({
    name: t.String(),
    description: t.String(),
    banner: t.String(),
    maker: t.Object({
      pfp: t.String(),
      name: t.String(),
    }),
    totalDevlogs: t.Number(),
    totalMinutes: t.Number(),
    followers: t.Number(),
    devlogs: t.Array(
      t.Object({
        posted: t.Date(),
        timeLogged: t.Number({ description: "Total minutes of a devlog"}),
        description: t.String(),
        imageUrls: t.Array(t.String()),
        totalComments: t.Number(),
        totalReposts: t.Number(),
        totalLikes: t.Number(),
        totalViews: t.Number(),
      }),
    ),
  });
}
