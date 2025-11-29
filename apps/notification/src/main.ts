import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationModule } from './use-case/notification.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3021,
      },
    },
  );
  await app.listen();
  console.log('Notification service is listening on port 3021');
}
bootstrap();

