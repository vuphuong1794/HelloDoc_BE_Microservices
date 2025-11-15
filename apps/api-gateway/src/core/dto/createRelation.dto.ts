import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateRelationDto {
  @IsString()
  fromLabel: string;

  @IsString()
  fromName: string;

  @IsString()
  toLabel: string;

  @IsString()
  toName: string;

  @IsString()
  relationType: string;

  @IsOptional()
  @IsNumber()
  weight?: number;
}
