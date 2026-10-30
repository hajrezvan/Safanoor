import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { LocationsModule } from '../locations/locations.module';
import { AlbumController } from './album.controller';
import { AlbumService } from './album.service';

@Module({
  imports: [FilesModule, LocationsModule],
  controllers: [AlbumController],
  providers: [AlbumService],
})
export class AlbumModule {}
