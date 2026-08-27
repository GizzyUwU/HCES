import { t, type TSchema } from "elysia";
import { TypeCompiler } from "elysia/type-system";

export const Nullable = <T extends TSchema>(schema: T) => {
  const union = t.Union([t.Null(), schema]);
  return Object.assign({}, union, TypeCompiler.Compile(union)) as typeof union;
};

export const Nullish = <T extends TSchema>(schema: T) =>
  t.Optional(t.Union([t.Null(), schema]));