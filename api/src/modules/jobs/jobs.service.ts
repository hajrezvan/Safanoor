import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';

export const queueNames = [
  'import-validate',
  'import-commit',
  'notification-deliver',
  'age-transition',
] as const;
export type QueueName = (typeof queueNames)[number];
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  boss?: PgBoss;
  async onModuleInit(): Promise<void> {
    if (process.env.OPENAPI_ONLY === 'true') return;
    this.boss = new PgBoss({
      connectionString:
        process.env.DATABASE_URL ??
        'postgresql://safanoor:safanoor_dev@localhost:55432/safanoor',
      application_name: 'safanoor-jobs',
    });
    this.boss.on('error', () => console.error('❌ Background queue error.'));
    await this.boss.start();
    for (const name of queueNames)
      await this.boss.createQueue(name, { retryLimit: 3, retryDelay: 10 });
  }
  async send(
    name: QueueName,
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!this.boss) throw new Error('Queue not initialized');
    await this.boss.send(name, data);
  }
  async onModuleDestroy(): Promise<void> {
    if (this.boss) await this.boss.stop({ graceful: true, timeout: 5000 });
  }
}
