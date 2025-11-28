import { IsString, IsEnum } from 'class-validator';

export class CreatePostCommentDto {
  @IsString()
  userId: string;

  @IsEnum(['User', 'Doctor'])
  userModel: 'User' | 'Doctor';

  @IsString()
  content: string;
}
