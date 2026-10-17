import { Global, Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AgeTransitionService } from './age-transition.service';

@Global()
@Module({
  providers: [JobsService, AgeTransitionService],
  exports: [JobsService, AgeTransitionService],
})
export class JobsModule {}
