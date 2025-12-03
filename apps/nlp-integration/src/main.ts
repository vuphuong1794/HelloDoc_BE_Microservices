import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { NlpIntegrationModule } from './use-case/nlp-integration.module';

async function bootstrap() {
  dotenv.config();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NlpIntegrationModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3022,
      },
    },
  );
  await app.listen();
  console.log('NLP intergration service is listening on port 3022');
}
bootstrap();
