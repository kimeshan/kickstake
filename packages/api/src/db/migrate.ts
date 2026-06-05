/**
 * Applies Drizzle migrations at deploy time using drizzle-orm's migrator (a
 * production dependency) — NOT the drizzle-kit CLI, which is a devDependency
 * and is stripped from the production Docker image. Reads the committed
 * ./drizzle folder (SQL + meta journal).
 *
 *   node dist/db/migrate.js
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
