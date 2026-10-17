import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { AccessService } from './access.service';
import { Action, ResourceType } from './access.types';
import { ActorRequest, POLICY, PUBLIC_ROUTE } from './policy.decorator';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const policy = this.reflector.getAllAndOverride<{
      type: ResourceType;
      action: Action;
    }>(POLICY, [context.getHandler(), context.getClass()]);
    if (!policy) throw new ForbiddenException();
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const body = request.body as
      | { groupId?: string; resourceType?: string; resourceId?: string }
      | undefined;
    const parameter = request.params.id;
    const id = typeof parameter === 'string' ? parameter : undefined;
    if (id && !isUUID(id)) throw new BadRequestException('شناسه معتبر نیست.');
    const resource =
      policy.type === 'grant' && policy.action === 'grant'
        ? await this.access.grantResource(body?.resourceType, body?.resourceId)
        : await this.access.resolve(
            policy.type,
            id,
            request.actor,
            body?.groupId,
          );
    await this.access.require(request.actor, policy.action, resource);
    return true;
  }
}
