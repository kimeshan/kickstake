import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { toNodeHandler } from "better-auth/node";
import { AppModule } from "./app.module";
import { auth } from "./auth/auth";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // CORS must be before auth handler so preflight OPTIONS requests get headers
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3800"],
    credentials: true,
  });

  // Mount better-auth before NestJS routes (handles /auth/* with all sub-paths)
  const authHandler = toNodeHandler(auth);
  app.use("/auth", authHandler);

  // Re-add JSON parser for NestJS routes
  app.use(require("express").json({ limit: "10mb" }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle("KickStake API")
    .setDescription("Football tournament sweepstake backend")
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  const port = process.env.PORT ?? 3801;
  await app.listen(port, "0.0.0.0");
  console.log(`API running on http://0.0.0.0:${port}`);

  // Graceful shutdown — release the port so --watch restarts cleanly
  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
bootstrap();
