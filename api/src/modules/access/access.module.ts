import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { GrantsService } from './grants.service';

@Module({ controllers: [AccessController], providers: [GrantsService] })
export class AccessModule {}
