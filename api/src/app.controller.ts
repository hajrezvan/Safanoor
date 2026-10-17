import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from './modules/access/policy.decorator';

export class HealthDto {
  @ApiProperty() status!: string;
  @ApiProperty() version!: string;
}
@ApiTags('health')
@Controller('health')
export class AppController {
  @Public()
  @Get()
  @ApiOkResponse({ type: HealthDto })
  health(): HealthDto {
    return { status: 'ok', version: '0.1.0' };
  }
}
