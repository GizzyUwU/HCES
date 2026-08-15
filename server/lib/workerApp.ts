import { Elysia } from "elysia";
import fsr, { LogLevel } from "elysia-fsr";
let appPromise: Promise<Elysia> | null = null;

async function buildWorkerApp() {
  const routes = await fsr({
    dir: "../routes/api/v1/(authed)",
    filter: "**/*.{ts,tsx,js,jsx,mjs,cjs}",
    logLevel: LogLevel.Default,
  });
  return new Elysia().use(routes);
}
 
export function workerApp(): Promise<Elysia> {
  if (!appPromise) appPromise = buildWorkerApp();
  return appPromise;
}