import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NlpIntegrationModule } from './use-case/nlp-integration.module';

async function bootstrap() {
  const port = 3060

  // Tạo HTTP application (để Render detect được)
  const app = await NestFactory.create(NlpIntegrationModule);

  // Thêm TCP microservice nếu cần
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: 3022, // TCP port khác với HTTP port
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');

  console.log(`HTTP server listening on port 3060`);
  console.log(`TCP microservice listening on port 3022`);
}
bootstrap();