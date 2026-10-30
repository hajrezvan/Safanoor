import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { PageMetaDto, PaginationDto } from '../../libs/http/http.dto';

export class LocationQueryDto extends PaginationDto {}

export class CreateLocationDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  label!: string;
}

export class LocationOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() active!: boolean;
}

export class LocationsPageDto extends PageMetaDto {
  @ApiProperty({ type: [LocationOptionDto] }) items!: LocationOptionDto[];
}
