import { Module } from '@nestjs/common';
import { NewsController } from '../controller/news.controller';
import { NewsService } from '../service/news.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { News, NewsSchema } from '../core/schema/news.schema';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CloudinaryService } from 'libs/cloudinary/src/service/cloudinary.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),

    //khai bao ket noi voi mongodb
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isDev = configService.get<string>('isDev') === 'true';
        const uri = isDev
          ? configService.get<string>('MONGO_URI_DEV')
          : configService.get<string>('MONGO_URI_PROD');

        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'newsConnection',
    }),

    //khai bao model cho USER
    MongooseModule.forFeature(
      [{ name: News.name, schema: NewsSchema }],
      'newsConnection',
    ),

    // //ket noi voi cloudnary service
    // ClientsModule.register([
    //   {
    //     name: 'CLOUDINARY_CLIENT',
    //     transport: Transport.TCP,
    //     options: {
    //       port: 3006,
    //     },
    //   },
    // ]),
  ],
  controllers: [NewsController],
  providers: [NewsService, CloudinaryService],
})
export class NewsModule { }
