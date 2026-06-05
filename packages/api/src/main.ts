import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();

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
