import { fetch } from "bun";
import { readdirSync } from "node:fs";
import { join } from "node:path";
const scrapers = join(import.meta.dir);
export async function preconnectScrapers() {
  const files = readdirSync(scrapers).filter((f) => f.endsWith("ts") && !["preconnect.ts", "types.ts", "typeUtils.ts"].includes(f));
  for (const file of files) {
    const mod = await import(join(scrapers, file));
    const config = mod.default.config;
    if (!config.baseUrl) continue;
    fetch.preconnect(config.baseUrl)
  }
}