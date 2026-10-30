import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { CampsController } from './camps.controller';
import { CampsService } from './camps.service';

@Module({
  imports: [FilesModule],
  controllers: [CampsController],
  providers: [CampsService],
  exports: [CampsService],
})
export class CampsModule {}
