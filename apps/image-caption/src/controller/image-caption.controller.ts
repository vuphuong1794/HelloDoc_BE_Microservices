import { BadRequestException, Body, Controller, Get } from '@nestjs/common';
import { ImageCaptionService } from '../service/image-caption.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class ImageCaptionController {
  constructor(
    private readonly imageCaptioningService: ImageCaptionService,
  ) { }

  @MessagePattern('image-caption.upload')
  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const result = await this.imageCaptioningService.generateCaption(
      file.buffer,
    );

    return {
      success: true,
      data: result,
    };
  }

  @MessagePattern('image-caption.processUrl')
  async processUrl(@Body('imageUrl') imageUrl: string) {
    if (!imageUrl) {
      throw new BadRequestException('No image URL provided');
    }

    const result = await this.imageCaptioningService.generateCaptionFromUrl(
      imageUrl,
    );

    return {
      success: true,
      data: result,
    };
  }

  @MessagePattern('image-caption.batch')
  async processBatch(@Body('files') files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No image files provided');
    }

    const buffers = files.map(f => f.buffer);
    const results = await this.imageCaptioningService.generateCaptionsBatch(
      buffers,
    );

    return {
      success: true,
      data: results,
    };
  }
}
