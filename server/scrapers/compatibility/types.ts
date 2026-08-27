import { t } from "elysia";
import { Nullable } from "../typeUtils";
export namespace CPTypes {
  export const ShopItem = t.Object({
    title: t.String(),
    description: t.String(),
    avgHours: t.String(),
    price: t.Number({ exclusiveMinimum: -Infinity }),
    stock: Nullable(t.Number())
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
      devlogId: t.Optional(t.Number({
        description: "Devlog ID",
      })),
    }),
  ]);
  export const Devlog = t.Object({
    id: t.String(),
    posted: t.Date(),
    timeLogged: t.String({ description: "Total time of a devlog in ISO 8601 Duration"}),
    description: t.String(),
    imageUrls: t.Array(t.Object({
      alt: t.String(),
      src: t.String(),
    })),
  });
  export const Devlogs = t.Array(Devlog);

  export const Project = t.Object({
    name: t.String(),
    description: t.String(),
    banner: t.String(),
    maker: t.Object({
      pfp: t.String(),
      name: t.String(),
    }),
    totalDevlogs: t.Number(),
    totalDuration: t.String({ description: "Total time in ISO 8601 Duration"}),
    followers: t.Number(),
    devlogIds: t.Array(t.Union([t.String(), t.Number()]))
  });
}
