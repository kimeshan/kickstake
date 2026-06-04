import "dotenv/config";
import { Pool } from "pg";
import { unlinkSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.DATABASE_URL!;
const TEST_DB_NAME = "kickstake_test";

export default async function globalTeardown() {
  const adminUrl = BASE_URL.replace(/\/[^/]+$/, "/postgres");
  const pool = new Pool({ connectionString: adminUrl });

  try {
    await pool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  } finally {
    await pool.end();
  }

  // Clean up .env.test
  try {
    unlinkSync(join(__dirname, "..", "..", ".env.test"));
  } catch {
    // .env.test may not exist; ignore.
  }
}
