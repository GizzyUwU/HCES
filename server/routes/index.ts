import Elysia from "elysia";
import pkg from "@root/package.json";

export default new Elysia()
  .get("", () => ({
    name: pkg.name,
    version: pkg.version,
  }));
