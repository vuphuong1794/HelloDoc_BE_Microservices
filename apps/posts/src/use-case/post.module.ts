import { Module } from '@nestjs/common';
import { PostService } from '../service/post.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../core/schema/post.schema';
import { PostController } from '../controller/posts.controller';

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
      connectionName: 'postConnection',
    }),
    MongooseModule.forFeature(
      [{ name: Post.name, schema: PostSchema }],
      'postConnection',
    ),],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule { }
