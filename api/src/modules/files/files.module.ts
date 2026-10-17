import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { LocalStorageAdapter, S3StorageAdapter, STORAGE } from './storage';

@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: STORAGE,
      useFactory: () =>
        process.env.STORAGE_DRIVER === 's3'
          ? new S3StorageAdapter()
          : new LocalStorageAdapter(),
    },
  ],
  exports: [STORAGE],
})
export class FilesModule {}
