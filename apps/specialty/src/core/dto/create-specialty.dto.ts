import { IsOptional, IsArray, IsMongoId, IsString, ValidateNested, IsBase64 } from 'class-validator';
import { ObjectId } from 'mongoose';
import { Express } from 'express';
import { Type } from 'class-transformer';

export class CreateSpecialtyDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImageDto)
    image?: ImageDto;

    @IsString()
    description: string;

    @IsOptional()
    @IsArray()
    @IsMongoId({ each: true })
    doctors: ObjectId[]; // Danh sách ID bác sĩ thuộc chuyên khoa (nếu có)
}

export class ImageDto {
    @IsBase64()
    buffer: string; // Base64 encoded image

    @IsString()
    originalname: string;

    @IsString()
    mimetype: string;
}

