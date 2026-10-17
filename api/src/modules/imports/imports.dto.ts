import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class ImportUploadDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() groupId!: string;
}
export class ImportJobDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() rowCount!: number;
  @ApiProperty() validCount!: number;
  @ApiProperty() errorCount!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() canConfirm!: boolean;
}
export class ImportRowDto {
  @ApiProperty() rowNumber!: number;
  @ApiProperty() name!: string;
  @ApiProperty() nationalIdMasked!: string;
  @ApiProperty({ type: [String] }) errors!: string[];
}
export class ImportRowsPageDto extends PageMetaDto {
  @ApiProperty({ type: [ImportRowDto] }) items!: ImportRowDto[];
}
export class ImportsPageDto extends PageMetaDto {
  @ApiProperty({ type: [ImportJobDto] }) items!: ImportJobDto[];
}
