import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApplication, openApiDocument } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApplication(app);
  if (process.env.NODE_ENV !== 'production')
    SwaggerModule.setup('api/docs', app, openApiDocument(app));
  await app.listen(
    Number(process.env.PORT ?? 3001),
    process.env.HOST ?? '0.0.0.0',
  );
}
void bootstrap().catch(() => {
  console.error(
    '❌ API startup failed. Check database connectivity and required environment keys.',
  );
  process.exitCode = 1;
});
