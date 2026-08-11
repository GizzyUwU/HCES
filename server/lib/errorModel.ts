import Elysia, { t } from "elysia";
export const errorModel = new Elysia().model({
  unauthorized: t.Object({
    err: t.Object({ status: t.Literal(401), msg: t.Literal("unauthorized") }),
  }),
  forbidden: t.Object({
    err: t.Object({ status: t.Literal(403), msg: t.Literal("forbidden") }),
  }),
  internalError: t.Object({
    err: t.Object({ status: t.Literal(500), msg: t.String() }),
  }),
  genericError: t.Object({
    err: t.Object({ status: t.Number(), msg: t.String() }),
  }),
});
