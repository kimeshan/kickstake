import { config } from "dotenv";
import { join } from "path";

// Ensure test mode — activates the OTP capture seam in email.ts and keeps
// auth cookies non-secure so supertest (http) works.
process.env.NODE_ENV = "test";

// Load base .env first (for BETTER_AUTH_SECRET etc.)
config({ path: join(__dirname, "..", "..", ".env") });
// Override DATABASE_URL with the test database
config({ path: join(__dirname, "..", "..", ".env.test"), override: true });
