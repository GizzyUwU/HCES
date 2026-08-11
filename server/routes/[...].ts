import Elysia from "elysia";

export default new Elysia().get("", ({ set }) => {
  set.status = 404;
  return { err: { status: 404, msg: "not_found" }}
})