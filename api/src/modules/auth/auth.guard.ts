import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ActorRequest, PUBLIC_ROUTE } from '../access/policy.decorator';
import { AuthService } from './auth.service';

export function cookieValue(
  request: Request,
  name: string,
): string | undefined {
  const value = (request.cookies as Record<string, unknown> | undefined)?.[
    name
  ];
  return typeof value === 'string' ? value : undefined;
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const authorization = request.headers.authorization;
    const bearer = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    const token = bearer ?? cookieValue(request, 'sf_access');
    if (!token)
      throw new UnauthorizedException('برای ادامه وارد حساب خود شوید.');
    const authenticated = await this.auth.authenticate(token);
    request.actor = authenticated.actor;
    request.sessionId = authenticated.sessionId;
    request.authMode = bearer ? 'bearer' : 'cookie';
    return true;
  }
}
