import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReportModule } from './use-case/report.module';
import * as dotenv from 'dotenv';

async function bootstrap() {
  dotenv.config();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ReportModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3017,
      },
    },
  );
  await app.listen();
  console.log('Report service is listening on port 3017');
}
bootstrap();
