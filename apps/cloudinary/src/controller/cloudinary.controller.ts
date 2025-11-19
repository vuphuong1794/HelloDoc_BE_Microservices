import { Controller, InternalServerErrorException, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CloudinaryService } from '../service/cloudinary.service';

@Controller()
export class CloudinaryController {
    constructor(private readonly cloudinaryService: CloudinaryService) { }

    @MessagePattern('cloudinary.upload')
    async upload(
        @Payload() payload: { buffer: string; filename: string; mimetype: string; folder: string },
    ) {
        try {
            // Convert Base64 string thành Buffer
            const bufferData = Buffer.from(payload.buffer, 'base64');

            console.log(`Cloudinary uploading: ${payload.filename}`);

            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: payload.folder,
                        resource_type: 'auto',
                        filename_override: payload.filename,
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    },
                );

                stream.end(bufferData); // Sử dụng Buffer từ Base64
            });

            //console.log(`Cloudinary upload success: ${result.secure_url}`);
            return result;
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw new InternalServerErrorException(error.message);
        }
    }
}
