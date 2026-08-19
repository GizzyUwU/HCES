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

  export const project = t.Object({
    name: t.String(),
    description: t.String(),
    banner: t.String(),
    maker: t.Object({
      pfp: t.String(),
      name: t.String(),
    }),
    totalDevlogs: t.Number(),
    totalHours: t.Number(),
    followers: t.Number(),
    devlogs: t.Array(
      t.Object({
        posted: t.Date(),
        timeLogged: t.Number({ description: "Total minutes of a devlog"}),
        description: t.String(),
        imageUrls: t.Array(t.String()),
      }),
    ),
  });
}
