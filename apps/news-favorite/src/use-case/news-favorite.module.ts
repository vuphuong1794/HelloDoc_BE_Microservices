import { Module } from '@nestjs/common';
import { NewsFavoriteService } from '../service/news-favorite.service';
import { NewsFavoriteController } from '../controller/news-favorite.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NewsFavorite, NewsFavoriteSchema } from '../core/schema/news-favorite.schema';
import { News, NewsSchema } from 'apps/news/src/core/schema/news.schema';
import { User, UserSchema } from 'apps/users/src/core/schema/user.schema';
import { Doctor, DoctorSchema } from 'apps/doctor/src/core/schema/doctor.schema';
import { Admin, AdminSchema } from 'apps/admin/src/core/schema/admin.schema';
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
          : configService.get<string>('MONGO_URI_NEWS');
        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'newsFavoriteConnection',
    }),
    MongooseModule.forFeature(
      [
        { name: NewsFavorite.name, schema: NewsFavoriteSchema },
        { name: News.name, schema: NewsSchema },
        { name: User.name, schema: UserSchema },
        { name: Doctor.name, schema: DoctorSchema },
        { name: Admin.name, schema: AdminSchema },
      ],
      'newsFavoriteConnection',
    ),
  ],
  controllers: [NewsFavoriteController],
  providers: [NewsFavoriteService],
})
export class NewsFavoriteModule {}
