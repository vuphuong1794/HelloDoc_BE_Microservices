import { PartialType } from '@nestjs/mapped-types';
import { CreateSpecialtyDto } from './create-specialty.dto';
import { Express } from 'express';
import { ObjectId } from 'mongoose';
import { IsArray, IsBase64, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSpecialtyDto extends PartialType(CreateSpecialtyDto) {
    // Thêm các trường còn thiếu
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImageDto)
    image?: ImageDto;
    name?: string;
    description?: string;
    doctors?: ObjectId[]; // Danh sách ID bác sĩ thuộc chuyên khoa (nếu có)
}

export class ImageDto {
    @IsBase64()
    buffer: string; // Base64 encoded image

    @IsString()
    originalname: string;

    @IsString()
    mimetype: string;
}
