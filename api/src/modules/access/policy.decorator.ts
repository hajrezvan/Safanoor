import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import { Action, Actor, ResourceType } from './access.types';

export const PUBLIC_ROUTE = 'safanoor.public';
export const POLICY = 'safanoor.policy';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Policy = (type: ResourceType, action: Action) =>
  SetMetadata(POLICY, { type, action });
export interface ActorRequest extends Request {
  actor: Actor;
  sessionId: string;
  authMode: 'cookie' | 'bearer';
}
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor =>
    context.switchToHttp().getRequest<ActorRequest>().actor,
);
