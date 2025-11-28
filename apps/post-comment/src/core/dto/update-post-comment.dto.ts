import { IsString, IsOptional } from 'class-validator';

export class UpdatePostCommentDto {
  @IsOptional()
  @IsString()
  content?: string;
}
