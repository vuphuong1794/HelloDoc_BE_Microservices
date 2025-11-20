import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsArray, IsMongoId, IsOptional, IsBase64, ValidateNested } from 'class-validator';
import { Express } from 'express';

export class ImageDto {
    @IsBase64()
    buffer: string; // Base64 encoded image

    @IsString()
    originalname: string;

    @IsString()
    mimetype: string;
}

export class UpdateNewsDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsArray()
    media?: string[];


    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImageDto)
    images?: ImageDto[];
}
