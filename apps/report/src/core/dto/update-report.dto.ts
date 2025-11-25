import { IsString, IsEnum, IsOptional } from 'class-validator';

export class UpdateReportStatusDto {
  @IsEnum(['opened', 'closed'])
  status: 'opened' | 'closed';
}

export class UpdateReportResponseDto {
  @IsString()
  responseContent: string;

  @IsString()
  responseTime: string;
}
