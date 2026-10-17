import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { cookieValue } from './auth.guard';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const origin = request.headers.origin;
    const expected = process.env.APP_ORIGIN ?? 'http://localhost:3033';
    if (origin && origin !== expected)
      throw new ForbiddenException('درخواست از مبدأ نامعتبر است.');
    const bearer = request.headers.authorization?.startsWith('Bearer ');
    if (
      !origin &&
      (bearer || request.headers['x-client-type'] === 'native') &&
      !cookieValue(request, 'sf_access') &&
      !cookieValue(request, 'sf_refresh')
    )
      return true;
    const cookie = cookieValue(request, 'sf_csrf');
    const header = request.headers['x-csrf-token'];
    if (
      !cookie ||
      typeof header !== 'string' ||
      cookie.length !== header.length ||
      !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))
    )
      throw new ForbiddenException('درخواست معتبر نیست. صفحه را تازه کنید.');
    return true;
  }
}
