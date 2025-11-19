import { IsNotEmpty, IsMongoId, IsString, IsArray, IsOptional, ValidateNested, IsBase64, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class ImageDto {
    @IsBase64()
    buffer: string; // Base64 encoded image

    @IsString()
    originalname: string;

    @IsString()
    mimetype: string;
}

export class CreateNewsDto {
    @IsNotEmpty()
    @IsMongoId()
    adminId: string;

    @IsNotEmpty()
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsString()
    content: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImageDto)
    images?: ImageDto[];
}