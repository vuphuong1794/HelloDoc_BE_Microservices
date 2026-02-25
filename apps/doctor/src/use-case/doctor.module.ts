import { Module } from '@nestjs/common';
import { DoctorController } from '../controller/doctor.controller';
import { DoctorService } from '../service/doctor.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Doctor, DoctorSchema } from '../core/schema/doctor.schema';
import { CacheService } from 'libs/cache.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PendingDoctor, PendingDoctorSchema } from '../core/schema/PendingDoctor.schema';
import { MediaUrlHelper } from 'libs/media-url.helper';

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
          : configService.get<string>('MONGO_URI_DOCTOR');

        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'doctorConnection',
    }),
    MongooseModule.forFeature(
      [
        { name: Doctor.name, schema: DoctorSchema },
        { name: PendingDoctor.name, schema: PendingDoctorSchema },
      ],
      'doctorConnection',
    ),
    CacheModule.register(),
    ClientsModule.register([
      {
        name: 'USERS_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
          queue: 'users_queue',
          queueOptions: {
            durable: true
          },
        },
      },
      {
        name: 'SPECIALTY_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
          queue: 'specialty_queue',
          queueOptions: {
            durable: true
          },
        },
      },
      {
        name: 'APPOINTMENT_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3007
        }
      },
      {
        name: 'MEDIA_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
          queue: 'media_queue',
          queueOptions: {
            durable: true
          },
        }
      },
      {
        name: 'REVIEW_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3018
        },
      },
    ])
  ],
  controllers: [DoctorController],
  providers: [DoctorService, CacheService, MediaUrlHelper],
})
export class DoctorModule { }
