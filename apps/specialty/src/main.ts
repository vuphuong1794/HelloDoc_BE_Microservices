import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SpecialtyModule } from './use-case/specialty.module';


async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    SpecialtyModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
        queue: 'specialty_queue',
        queueOptions: {
          durable: true
        },
      },
    },
  );
  await app.listen();
  console.log('Specialty service is listening on port 3009');
}
bootstrap();
