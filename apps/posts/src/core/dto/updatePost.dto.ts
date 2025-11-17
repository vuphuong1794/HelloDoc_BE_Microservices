import { IsOptional, IsString } from 'class-validator';
import { Express } from 'express';

export class UpdatePostDto {
    @IsOptional()
    content?: string;

    @IsOptional()
    media?: string[]; // Mảng URL ảnh cũ

    @IsOptional()
    images?: Express.Multer.File[]; // Đây là phần cần được xác định rõ

    @IsOptional()
    keywords?: string;

}

export class UpdateKeywordsDto {
    @IsString()
    keywords: string;
}