import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SpecialtyModule } from './use-case/specialty.module';

async function bootstrap() {
  // HTTP app để Render detect port
  const app = await NestFactory.create(SpecialtyModule);
  const port = 3009;

  // RMQ Microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RMQ_URL || 'amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
      queue: 'specialty_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`Specialty service is listening on port ${port}`);
}
bootstrap();