import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module';
import { AssistantInvitesController } from './assistant-invites.controller';
import { AssistantInvitesService } from './assistant-invites.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [PeopleModule],
  controllers: [GroupsController, AssistantInvitesController],
  providers: [GroupsService, AssistantInvitesService],
})
export class GroupsModule {}
