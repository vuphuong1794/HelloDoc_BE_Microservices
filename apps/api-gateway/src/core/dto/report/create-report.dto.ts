import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateReportDto {
  @IsString()
  reporter: string;

  @IsEnum(['User', 'Doctor'])
  reporterModel: 'User' | 'Doctor';

  @IsString()
  content: string;

  @IsEnum(['Người dùng', 'Bác sĩ', 'Ứng dụng', 'Bài viết'])
  type: 'Người dùng' | 'Bác sĩ' | 'Ứng dụng' | 'Bài viết';

  @IsString()
  reportedId: string;

  @IsOptional()
  @IsString()
  postId?: string;
}
