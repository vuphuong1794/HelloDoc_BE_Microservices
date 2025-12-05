import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class ImageCaptionService {
    constructor(
        @Inject('IMAGE_CAPTION_CLIENT') private imageCaptionClient: ClientProxy
    ) { }

    async uploadImage(file: Express.Multer.File) {
        return this.imageCaptionClient.send('image-caption.upload', file);
    }

    async processUrl(url: string) {
        return this.imageCaptionClient.send('image-caption.processUrl', url);
    }

    async processBatch(files: Express.Multer.File[]) {
        return this.imageCaptionClient.send('image-caption.processBatch', files);
    }
}
