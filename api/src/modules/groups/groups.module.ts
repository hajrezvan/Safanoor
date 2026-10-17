import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [PeopleModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
