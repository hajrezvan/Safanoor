import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { LmsController } from './lms.controller';
import { LmsService } from './lms.service';

@Module({
  imports: [FilesModule],
  controllers: [LmsController],
  providers: [LmsService],
})
export class LmsModule {}
