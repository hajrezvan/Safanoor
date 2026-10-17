import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { databaseOptions } from './data-source';

const docsOnly = process.env.OPENAPI_ONLY === 'true';
@Global()
@Module({
  imports: docsOnly ? [] : [TypeOrmModule.forRoot(databaseOptions)],
  providers: docsOnly
    ? [
        {
          provide: DataSource,
          useFactory: () => new DataSource(databaseOptions),
        },
      ]
    : [],
  exports: docsOnly ? [DataSource] : [TypeOrmModule],
})
export class DatabaseModule {}
