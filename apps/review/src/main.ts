import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReviewModule } from './use-case/review.module';
import * as dotenv from 'dotenv';

async function bootstrap() {
  dotenv.config();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ReviewModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3018,
      },
    },
  );
  await app.listen();
  console.log('Review service is listening on port 3018');
}
bootstrap();
