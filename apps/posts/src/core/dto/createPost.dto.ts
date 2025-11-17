import { IsNotEmpty, IsMongoId, IsIn, IsString, IsArray, IsOptional } from 'class-validator';
import { Express } from 'express';

export class CreatePostDto {
    @IsNotEmpty()
    @IsMongoId()
    userId: string;

    @IsString()
    @IsNotEmpty()
    @IsIn(['User', 'Doctor'])
    userModel: string;

    @IsString()
    content: string;

    @IsOptional()
    images?: Express.Multer.File[];

    @IsOptional()
    keywords?: string;
}
