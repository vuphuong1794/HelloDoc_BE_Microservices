import { Module } from '@nestjs/common';
import { ImageCaptionController } from '../controller/image-caption.controller';
import { ImageCaptionService } from '../service/image-caption.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule
  ],
  controllers: [ImageCaptionController],
  providers: [ImageCaptionService],
})
export class ImageCaptionModule { }
