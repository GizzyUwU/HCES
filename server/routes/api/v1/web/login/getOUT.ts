import Elysia from "elysia";
import { auth } from "@server/lib/auth";

export default new Elysia()
  .use(auth)
  .get("", ({ profiles }) => ({
    url: profiles("hackclub").hackclub.logout ?? "",
  }));
