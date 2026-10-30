import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { ConfigModule } from './libs/config/config.module';
import { DatabaseModule } from './libs/database/database.module';
import { LoggerMiddleware } from './libs/logger/logger.middleware';
import { SecurityModule } from './libs/security/security.module';
import { AccessModule } from './modules/access/access.module';
import { PolicyGuard } from './modules/access/policy.guard';
import { AdminModule } from './modules/admin/admin.module';
import { AlbumModule } from './modules/album/album.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { CsrfGuard } from './modules/auth/csrf.guard';
import { AuthModule } from './modules/auth/auth.module';
import { CampsModule } from './modules/camps/camps.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { ConsentModule } from './modules/consent/consent.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FilesModule } from './modules/files/files.module';
import { FinanceModule } from './modules/finance/finance.module';
import { GroupsModule } from './modules/groups/groups.module';
import { ImportsModule } from './modules/imports/imports.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LibraryModule } from './modules/library/library.module';
import { LmsModule } from './modules/lms/lms.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PeopleModule } from './modules/people/people.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SecurityModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AuthModule,
    PeopleModule,
    DashboardModule,
    GroupsModule,
    CampsModule,
    CommunicationsModule,
    LibraryModule,
    LmsModule,
    MeetingsModule,
    ConsultationsModule,
    FinanceModule,
    AlbumModule,
    LocationsModule,
    NotificationsModule,
    JobsModule,
    AccessModule,
    ConsentModule,
    ImportsModule,
    AdminModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [
    ThrottlerGuard,
    { provide: APP_GUARD, useExisting: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
