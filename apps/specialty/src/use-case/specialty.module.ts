import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { Specialty, SpecialtySchema } from '../core/schema/specialty.schema';
import { SpecialtyController } from '../controller/specialty.controller';
import { SpecialtyService } from '../service/specialty.service';
import { CacheService } from 'libs/cache.service';
import { CloudinaryService } from 'libs/cloudinary/src/service/cloudinary.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
    JwtModule.register({ global: true, secret: "secretKey" }),
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
      connectionName: 'specialtyConnection',
    }),

    CacheModule.register({
      store: redisStore,
      ttl: 3600 * 1000, // mặc định TTL
      url: 'rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379',
      isGlobal: true,
    }),
    //khai bao model cho USER
    MongooseModule.forFeature(
      [{ name: Specialty.name, schema: SpecialtySchema }],
      'specialtyConnection',
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
  controllers: [SpecialtyController],
  providers: [SpecialtyService, CacheService, CloudinaryService],
})
export class SpecialtyModule { }
