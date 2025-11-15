import { IsString } from 'class-validator';

export class CreateNodeDto {
  @IsString()
  label: string;

  @IsString()
  name: string;
}
