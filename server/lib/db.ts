import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readdir } from "node:fs/promises";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export let db: ReturnType<typeof drizzle> = drizzle({
  client: new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: Number(process.env["DB_POOL_MAX"]) || 20,
    idleTimeoutMillis: 30 * 1000,
    connectionTimeoutMillis: 5 * 1000,
  }),
});

let migrationsExists = true;

try {
  await readdir("./migrations");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    migrationsExists = false;
  } else {
    throw error;
  }
}

if (migrationsExists) {
  await migrate(db, {
    migrationsFolder: "./migrations",
  });
}
