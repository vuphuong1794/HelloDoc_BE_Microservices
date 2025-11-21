import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { EmbeddingModule } from './use-case/embedding.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    EmbeddingModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3012,
      },
    },
  );
  await app.listen();
  console.log('Embedding service is listening on port 3003');
}
bootstrap();
