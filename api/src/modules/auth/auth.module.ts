import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_PROVIDER, PasswordProvider } from './password.provider';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32)
          throw new Error('JWT_SECRET must have at least 32 characters');
        return { secret };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_PROVIDER, useClass: PasswordProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
