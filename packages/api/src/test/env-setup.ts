import { config } from "dotenv";
import { join } from "path";

// Load base .env first (for BETTER_AUTH_SECRET etc.)
config({ path: join(__dirname, "..", "..", ".env") });
// Override DATABASE_URL with the test database
config({ path: join(__dirname, "..", "..", ".env.test"), override: true });
