import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { toNodeHandler } from "better-auth/node";
import { AppModule } from "./app.module";
import { auth } from "./auth/auth";

/**
 * Builds the Nest app with the better-auth middleware mounted exactly as in
 * production. Shared by main.ts (adds Swagger + listen) and the test harness
 * (so integration tests exercise the real auth + routing stack).
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3800"],
    credentials: true,
  });

  // Mount better-auth before NestJS routes (handles /auth/* with all sub-paths)
  app.use("/auth", toNodeHandler(auth));

  // Re-add JSON parser for NestJS routes
  app.use(require("express").json({ limit: "10mb" }));

  return app;
}
