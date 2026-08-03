import { Elysia } from "elysia";
import fsr, { LogLevel } from "elysia-fsr";
import { configure, getConsoleSink } from "@logtape/logtape";
import { elysiaLogger } from "@logtape/elysia";
import { AsyncLocalStorage } from "node:async_hooks";

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ["hces"], sinks: ["console"], lowestLevel: "info" }
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

export const app = new Elysia()
  .use(elysiaLogger({
    category: ["hces"],
    context: {
      requestId: {
        headerNames: ["x-correlation-id", "x-request-id"],
        responseHeader: "x-request-id",
      },
      include: ["requestId", "method", "path"],
      enrich: (ctx) => ({ route: ctx.path }),
    },
  }))
  .use(
    await fsr({
      dir: "./routes",
      filter: "**/*.{ts,tsx,js,jsx,mjs,cjs}",
      logLevel: LogLevel.Default,
      types: {
        dir: "./src/types",
        importAlias: "import-route-files-alias",
      },
    })
  )
  .listen(3000, ({ url }) => console.log(`Server is running on ${url}`));