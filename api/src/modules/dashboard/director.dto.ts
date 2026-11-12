import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../libs/http/http.dto';

export class DirectorMetricDto {
  @ApiProperty() key!: string;
  @ApiProperty() count!: number;
}
export class DirectorSummaryDto {
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ type: [DirectorMetricDto] }) metrics!: DirectorMetricDto[];
}
export class DirectorPersonDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() orgLevel!: string;
  @ApiProperty() groupName!: string;
}
export class DirectorPeoplePageDto extends PageMetaDto {
  @ApiProperty({ type: [DirectorPersonDto] }) items!: DirectorPersonDto[];
}
