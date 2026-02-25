import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SpecialtyModule } from './use-case/specialty.module';


async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    SpecialtyModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
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
