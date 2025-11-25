import { Module } from '@nestjs/common';
import { PostFavoriteService } from '../service/post-favorite.service';
import { PostFavoriteController } from '../controller/post-favorite.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PostFavorite, PostFavoriteSchema } from '../core/schema/post-favorite.schema';
import { Post, PostSchema } from 'apps/posts/src/core/schema/post.schema';
import { User, UserSchema } from 'apps/users/src/core/schema/user.schema';
import { Doctor, DoctorSchema } from 'apps/doctor/src/core/schema/doctor.schema';
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
          : configService.get<string>('MONGO_URI_POST'); // Using Post DB for favorites as they are related
        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'postFavoriteConnection',
    }),
    MongooseModule.forFeature(
      [
        { name: PostFavorite.name, schema: PostFavoriteSchema },
        { name: Post.name, schema: PostSchema },
        { name: User.name, schema: UserSchema },
        { name: Doctor.name, schema: DoctorSchema },
      ],
      'postFavoriteConnection',
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
        name: 'POST_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3002,
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
  controllers: [PostFavoriteController],
  providers: [PostFavoriteService],
})
export class PostFavoriteModule {}
