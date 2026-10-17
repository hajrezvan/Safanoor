import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

process.env.OPENAPI_ONLY = 'true';
process.env.JWT_SECRET ??= randomBytes(32).toString('hex');
process.env.ENCRYPTION_KEYS ??= JSON.stringify({
  v1: randomBytes(32).toString('base64'),
});
process.env.NATIONAL_ID_HMAC_KEY ??= randomBytes(32).toString('hex');
async function main(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');
  const { configureApplication, openApiDocument } = await import('./bootstrap');
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApplication(app);
  writeFileSync(
    'openapi.json',
    `${JSON.stringify(openApiDocument(app), null, 2)}\n`,
  );
  await app.close();
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
