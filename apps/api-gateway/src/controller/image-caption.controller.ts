import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    Body,
    BadRequestException,
    UploadedFiles,
    Get,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ImageCaptionService } from '../services/image-caption.service';

@Controller('image-captioning')
export class ImageCaptioningController {
    constructor(
        private readonly imageCaptioningService: ImageCaptionService,
    ) { }

    @Post('upload')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
    async uploadImage(@UploadedFiles() files: { images?: Express.Multer.File[] }) {
        if (!files.images || files.images.length === 0) {
            throw new BadRequestException('No image files provided');
        }

        return await this.imageCaptioningService.uploadImage(files.images[0]);


    }

    @Post('url')
    async processUrl(@Body('imageUrl') imageUrl: string) {
        if (!imageUrl) {
            throw new BadRequestException('No image URL provided');
        }

        const result = await this.imageCaptioningService.processUrl(
            imageUrl,
        );

        return {
            success: true,
            data: result,
        };
    }

    @Post('batch')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'files', maxCount: 10 }]))
    async processBatch(@UploadedFile() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No image files provided');
        }

        const results = await this.imageCaptioningService.processBatch(files);

        return {
            success: true,
            data: results,
        };
    }

    @Get('test')
    async test() {
        const testImageUrl = 'https://huggingface.co/datasets/Narsil/image_dummy/raw/main/parrots.png';

        try {
            const result = await this.imageCaptioningService.processUrl(testImageUrl);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}