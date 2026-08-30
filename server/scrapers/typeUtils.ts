import { t, type TSchema } from "elysia";
import { TypeCompiler } from "elysia/type-system";

export const Nullable = <T extends TSchema>(schema: T) => {
  const union = t.Union([schema, t.Null()]);
  return Object.assign({}, union, TypeCompiler.Compile(union)) as typeof union;
};

export const Nullish = <T extends TSchema>(schema: T) =>
  t.Optional(t.Union([schema, t.Null()]));

export const Duration = "^P(?!$)((\\d+Y)?(\\d+M)?(\\d+D)?(T(?=\\d)(\\d+H)?(\\d+M)?(\\d+S)?)?|\\d+W)$";
