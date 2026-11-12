import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JobsService } from './modules/jobs/jobs.service';
import { AgeTransitionService } from './modules/jobs/age-transition.service';
import { ImportsService } from './modules/imports/imports.service';
import { NotificationsService } from './modules/notifications/notifications.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  const boss = app.get(JobsService).boss;
  if (!boss) throw new Error('Queue unavailable');
  const imports = app.get(ImportsService);
  const notifications = app.get(NotificationsService);
  const age = app.get(AgeTransitionService);
  await boss.work<{ id: string }>('import-validate', async (jobs) => {
    for (const job of jobs) await imports.validate(job.data.id);
  });
  await boss.work<{ id: string }>('import-commit', async (jobs) => {
    for (const job of jobs) await imports.commit(job.data.id);
  });
  await boss.work('notification-deliver', async () => {
    await notifications.remindFollowUps();
    await notifications.deliverPending();
  });
  await boss.work('age-transition', async () => {
    await age.run();
  });
  await boss.schedule(
    'notification-deliver',
    '* * * * *',
    {},
    { tz: 'Asia/Tehran' },
  );
  await boss.schedule('age-transition', '0 0 * * *', {}, { tz: 'UTC' });
  await notifications.remindFollowUps();
  await notifications.deliverPending();
  await age.run();
}
void main().catch(() => {
  console.error(
    '❌ Worker startup failed. Check environment and database connectivity.',
  );
  process.exitCode = 1;
});
