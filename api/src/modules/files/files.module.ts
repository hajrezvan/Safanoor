import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { StorageRuntimeService } from './storage-runtime.service';
import { STORAGE, SwitchingStorageAdapter } from './storage';

@Module({
  controllers: [FilesController],
  providers: [
    StorageRuntimeService,
    {
      provide: STORAGE,
      useFactory: (runtime: StorageRuntimeService) =>
        new SwitchingStorageAdapter(() => runtime.current()),
      inject: [StorageRuntimeService],
    },
  ],
  exports: [STORAGE, StorageRuntimeService],
})
export class FilesModule {}
