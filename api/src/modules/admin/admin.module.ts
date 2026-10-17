import { Module } from '@nestjs/common';
import { AUTH_PROVIDER, PasswordProvider } from '../auth/password.provider';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    { provide: AUTH_PROVIDER, useClass: PasswordProvider },
  ],
})
export class AdminModule {}
