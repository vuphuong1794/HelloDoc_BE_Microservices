import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MediaModule } from './use-case/media.module';

async function bootstrap() {
  const app = await NestFactory.create(MediaModule);
  const port = 3006;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RMQ_URL || 'amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
      queue: 'media_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`Media service is listening on port ${port}`);
}
bootstrap();