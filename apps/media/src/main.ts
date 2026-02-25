import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MediaModule } from './use-case/media.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MediaModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: 'media_queue',
        queueOptions: {
          durable: true
        },
      },
    },
  );
  await app.listen();
  console.log('Media service is listening on port 3006');
}
bootstrap();
