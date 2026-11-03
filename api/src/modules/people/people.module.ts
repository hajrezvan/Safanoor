import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { AvatarService } from './avatar.service';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [FilesModule],
  controllers: [PeopleController],
  providers: [PeopleService, AvatarService],
  exports: [PeopleService],
})
export class PeopleModule {}
