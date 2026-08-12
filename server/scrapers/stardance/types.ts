import t, { type TSchema } from "typebox";
export const Nullable = <T extends TSchema>(schema: T) =>
  t.Union([t.Null(), schema]);

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
}
