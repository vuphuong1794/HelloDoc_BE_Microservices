import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { CloudinaryModule } from './use-case/cloudinary.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    CloudinaryModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3006,
      },
    },
  );
  await app.listen();
  console.log('Cloudinary service is listening on port 3006');
}
bootstrap();
