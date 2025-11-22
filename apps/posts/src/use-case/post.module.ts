import { Module } from '@nestjs/common';
import { PostService } from '../service/post.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../core/schema/post.schema';
import { User, UserSchema } from 'apps/users/src/core/schema/user.schema';
import {
  Doctor,
  DoctorSchema,
} from 'apps/doctor/src/core/schema/doctor.schema';
import { PostController } from '../controller/posts.controller';
import { CacheService } from 'libs/cache.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
          : configService.get<string>('MONGO_URI_POST');

        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'postConnection',
    }),
    MongooseModule.forFeature(
      [
        { name: Post.name, schema: PostSchema },
        { name: User.name, schema: UserSchema },
        { name: Doctor.name, schema: DoctorSchema }
      ],
      'postConnection',
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
        name: 'CLOUDINARY_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3006,
        },
      },
      {
        name: 'EMBEDDING_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3012,
        },
      },
      {
        name: 'QDRANT_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3013,
        },
      },
    ]),
  ],
  controllers: [PostController],
  providers: [PostService, CacheService],
})
export class PostModule { }
