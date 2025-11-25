import { IsString, IsMongoId, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @IsMongoId()
  userId: string;

  @IsString()
  @IsMongoId()
  doctorId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional() 
  comment?: string;
}
