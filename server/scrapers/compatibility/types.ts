import { t } from "elysia";
import { Duration, Nullable } from "@server/scrapers/typeUtils";
export namespace CPTypes {
  export const ShopParams = t.Object({
    id: t.Optional(t.String({
      description: "Item ID",
    }))
  });
  export const ShopItem = t.Object({
    id: t.String(),
    title: t.Union([t.String(), t.Literal("NAME_NOT_SET")]),
    description: t.String(),
    image: Nullable(t.String({
      format: "uri"
    })),
    avgHours: t.Number({
      minimum: 0
    }),
    price: t.Number({ exclusiveMinimum: -Infinity }),
    stock: Nullable(t.Number()),
    regionsEnabled: Nullable(t.Record(t.String(), t.Boolean()))
  });
  export const ShopItems = t.Array(ShopItem);

  export const ProjectParams = t.Object({
    id: t.String({
      description: "Project ID",
    }),
  });
  export const DevlogParams = t.Composite([
    ProjectParams,
    t.Object({
      devlogId: t.Optional(
        t.String({
          description: "Devlog ID",
        }),
      ),
    }),
  ]);
  export const Devlog = t.Object({
    id: t.String(),
    posted: t.String({
      format: "date-time"
    }),
    timeLogged: t.String({
      description: "Total time of a devlaog in ISO 8601 duration format",
      pattern: Duration,
    }),
    description: t.String(),
    mediaUrls: t.Array(
      t.Object({
        alt: t.String(),
        src: t.String(),
      }),
    ),
    likes: Nullable(t.Number({
      minimum: 0
    })),
    comments: Nullable(t.Number({
      minimum: 0
    }))
  });
  export const Devlogs = t.Array(Devlog);

  export const Project = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    banner: Nullable(t.String()),
    maker: Nullable(t.Object({
      pfp: t.String(),
      name: t.String(),
    })),
    demoUrl: Nullable(t.String({
      format: "uri"
    })),
    repoUrl: Nullable(t.String({
      format: "uri"
    })),
    readmeUrl: Nullable(t.String({
      format: "uri"
    })),
    aiDec: Nullable(t.String()),
    totalDevlogs: t.Number(),
    totalDuration: Nullable(t.String({
      description: "Total time in ISO 8601 duration format",
      pattern: Duration,
    })),
    followers: Nullable(t.Number()),
    devlogIds: t.Array(t.Union([t.String(), t.String()])),
    createdAt: Nullable(t.String({
      format: "date-time",
    })),
  });
}
