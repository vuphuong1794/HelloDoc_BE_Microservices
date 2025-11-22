import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { NotificationController } from '../controller/notification.controller';
import { NotificationService } from '../service/notification.service';
import {
  Notification,
  NotificationSchema,
} from '../core/schema/notification.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),

    JwtModule.register({
      global: true,
      secret: 'secretKey',
      signOptions: { expiresIn: '24h' },
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isDev = configService.get<string>('isDev') === 'true';
        const uri = isDev
          ? configService.get<string>('MONGO_URI_DEV')
          : configService.get<string>('MONGO_URI_NOTIFICATION');
        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'notificationConnection',
    }),

    MongooseModule.forFeature(
      [{ name: Notification.name, schema: NotificationSchema }],
      'notificationConnection',
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
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule { }

