import { Module } from '@nestjs/common';
import { PostService } from '../service/post.service';
import { PostController } from '../controller/post.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../core/schema/post.schema';
import { User, UserSchema } from 'apps/users/src/core/schema/user.schema';
import { Doctor, DoctorSchema } from 'apps/doctor/src/core/schema/doctor.schema';
import { CloudinaryService } from 'libs/cloudinary/src/service/cloudinary.service';
import { CacheService } from 'libs/cache.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
    CacheModule.register({
      store: redisStore,
      ttl: 3600 * 1000, // mặc định TTL
      url: 'rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379',
      isGlobal: true,
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
      connectionName: 'userConnection',
    }),
    MongooseModule.forFeature(
      [
        { name: Post.name, schema: PostSchema },
        { name: User.name, schema: UserSchema },
        { name: Doctor.name, schema: DoctorSchema }
      ],
      'userConnection',
    ),
  ],
  controllers: [PostController],
  providers: [PostService, CloudinaryService, CacheService],
})
export class PostModule { }
