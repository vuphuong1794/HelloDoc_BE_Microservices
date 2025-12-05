import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { UndertheseaModule } from './use-case/underthesea.module';

async function bootstrap() {
  const port = 3058

  // Tạo HTTP application (để Render detect được)
  const app = await NestFactory.create(UndertheseaModule);

  // Thêm TCP microservice nếu cần
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: 3020, // TCP port khác với HTTP port
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');

  console.log(`HTTP server listening on port 3058`);
  console.log(`TCP microservice listening on port 3020`);
}
bootstrap();