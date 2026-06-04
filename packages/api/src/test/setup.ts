import "dotenv/config";
import { Pool } from "pg";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.DATABASE_URL!;
const TEST_DB_NAME = "kickstake_test";
const TEST_URL = BASE_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);

export default async function globalSetup() {
  // Connect to default postgres DB to create the test database
  const adminUrl = BASE_URL.replace(/\/[^/]+$/, "/postgres");
  const pool = new Pool({ connectionString: adminUrl });

  try {
    // Drop and recreate test database for a clean slate
    await pool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await pool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await pool.end();
  }

  // Run migrations on the test database
  execSync(`DATABASE_URL=${TEST_URL} npx drizzle-kit push --force`, {
    cwd: join(__dirname, "..", ".."),
    stdio: "pipe",
  });

  // Write the test URL so the test workers can pick it up
  const envTestPath = join(__dirname, "..", "..", ".env.test");
  writeFileSync(envTestPath, `DATABASE_URL=${TEST_URL}\n`);

  // Also set for this process
  process.env.DATABASE_URL = TEST_URL;
}
