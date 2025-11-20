import { Module } from '@nestjs/common';
import { MedicalserviceController } from '../controller/medicalservice.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Mongoose } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import config from 'apps/config/config';
import { MedicalOption, MedicalOptionSchema } from '../core/scheme/medical-option.scheme';
import { MedicalserviceService } from '../service/medicalservice.service';

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
          : configService.get<string>('MONGO_URI_PROD');

        return { uri };
      },
    inject: [ConfigService],
    connectionName: 'medicalServiceConnection',
    }),
    MongooseModule.forFeature(
      [
        { name: MedicalOption.name, schema: MedicalOptionSchema },
    ],
      'medicalServiceConnection',
    ),
  ],
  controllers: [MedicalserviceController],
  providers: [MedicalserviceService],
})
export class MedicalServiceModule {}
