import { Module } from '@nestjs/common';
import { CloudinaryService } from '../service/cloudinary.service';
import { CloudinaryProvider } from '../provider/cloudinary.provider';

@Module({
  imports: [],
  controllers: [],
  providers: [CloudinaryService, CloudinaryProvider],
  exports: [CloudinaryService, CloudinaryProvider],
})
export class CloudinaryModule { }
