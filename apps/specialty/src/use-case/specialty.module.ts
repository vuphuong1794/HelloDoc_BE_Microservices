import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { Specialty, SpecialtySchema } from '../core/schema/specialty.schema';
import { SpecialtyController } from '../controller/specialty.controller';
import { SpecialtyService } from '../service/specialty.service';
import { CacheService } from 'libs/cache.service';
import { DiscordLoggerService } from 'libs/discord-logger.service';
//import { CloudinaryService } from 'libs/cloudinary/src/service/cloudinary.service';

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
          : configService.get<string>('MONGO_URI_SPECIALTY');

        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'specialtyConnection',
    }),

    CacheModule.register({
      // @ts-ignore
      store: new KeyvRedis('rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379'),
      ttl: 3600 * 1000, // mặc định TTL
      isGlobal: true,
    }),
    //khai bao model cho USER
    MongooseModule.forFeature(
      [{ name: Specialty.name, schema: SpecialtySchema }],
      'specialtyConnection',
    ),
    ClientsModule.register([
      {
        name: 'DOCTOR_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@localhost:5672'],
          queue: 'doctor_queue',
          queueOptions: {
            durable: true //keep messages in the queue if the consumer is not connected
          },
        },
      },
      {
        name: 'CLOUDINARY_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3006,
        },
      },
    ]),

  ],
  controllers: [SpecialtyController],
  providers: [SpecialtyService, CacheService, DiscordLoggerService],
})
export class SpecialtyModule { }
