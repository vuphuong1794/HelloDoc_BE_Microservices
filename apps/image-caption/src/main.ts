import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ImageCaptionModule } from './use-case/image-caption.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ImageCaptionModule,
    {
      transport: Transport.TCP,
      options: { port: 3023 },
    },
  );
  await app.listen();
  console.log('Image Caption service is listening on port 3023');
}
bootstrap();
