import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { QdrantModule } from './use-case/qdrant.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    QdrantModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3013,
      },
    },
  );
  await app.listen();
  console.log('Qdrant service is listening on port 3003');
}
bootstrap();

