import { Module } from '@nestjs/common';
import { ApiGatewayController } from '../controller/api-gateway.controller';
import { ApiGatewayService } from '../services/api-gateway.service';
import { UsersModule } from './users.module';
import { ProjectsModule } from './projects.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from '../config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { JwtModule } from '@nestjs/jwt';
import { DoctorModule } from './doctor.module';
import { NewsModule } from './news.module';
import { AuthModule } from './auth.module';
import { Neo4jModule } from './neo4j.module';
import { AppointmentModule } from './appointment.module';
import { SpecialtyModule } from './specialty.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
    JwtModule.register({ global: true, secret: "secretKey" }),
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
    }),
    CacheModule.register({
      store: redisStore,
      ttl: 3600 * 1000, // mặc định TTL
      url: 'rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379',
      isGlobal: true,
    }),
    UsersModule, DoctorModule, NewsModule, AuthModule, AppointmentModule, SpecialtyModule, Neo4jModule
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule { }
