import { Module } from '@nestjs/common';
import { NewsCommentController } from '../controller/news-comment.controller';
import { NewsCommentService } from '../service/news-comment.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NewsComment, NewsCommentSchema } from '../core/schema/news-comment.schema';
import config from 'apps/config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
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
      connectionName: 'newsCommentConnection',
    }),
    MongooseModule.forFeature(
      [
        { name: NewsComment.name, schema: NewsCommentSchema },
      ],
      'newsCommentConnection',
    ),
    ClientsModule.register([
      {
        name: 'USERS_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3001,
        },
      },
      {
        name: 'DOCTOR_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3003,
        },
      },
      {
        name: 'ADMIN_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3010,
        },
      },
      {
        name: 'NEWS_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3004,
        },
      },
      {
        name: 'NOTIFICATION_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3018,
        },
      },
    ]),
  ],
  controllers: [NewsCommentController],
  providers: [NewsCommentService],
})
export class NewsCommentModule {}

