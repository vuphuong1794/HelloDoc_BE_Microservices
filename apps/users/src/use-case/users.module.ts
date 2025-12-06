import { Module } from '@nestjs/common';
import { UsersController } from '../controller/users.controller';
import { UsersService } from '../service/users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../core/schema/user.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

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
          : configService.get<string>('MONGO_URI_USER');

        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'userConnection',
    }),

    CacheModule.register({
      store: redisStore,
      ttl: 3600 * 1000, // mặc định TTL
      url: 'rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379',
      isGlobal: true,
    }),
    //khai bao model cho USER
    MongooseModule.forFeature(
      [{ name: User.name, schema: UserSchema }],
      'userConnection',
    ),


    ClientsModule.register([
      {
        name: 'DOCTOR_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3003,
        },
      },
      {
        name: 'SPECIALTY_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3009,
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
        name: 'ADMIN_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3010,
        },
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule { }
