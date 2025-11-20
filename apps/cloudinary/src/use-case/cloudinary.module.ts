import { Module } from '@nestjs/common';
import { CloudinaryService } from '../service/cloudinary.service';
import { CloudinaryProvider } from '../provider/cloudinary.provider';
import { CloudinaryController } from '../controller/cloudinary.controller';
import { ConfigModule } from '@nestjs/config';
import config from 'apps/config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
  ],
  controllers: [CloudinaryController],
  providers: [CloudinaryService, CloudinaryProvider],
  exports: [CloudinaryService, CloudinaryProvider],
})
export class CloudinaryModule { }
