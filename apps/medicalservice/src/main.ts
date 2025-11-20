import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MedicalServiceModule } from './use-case/medicalservice.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MedicalServiceModule,
    { transport: Transport.TCP,
      options: {
        port: 3011,
      },
    },  
  );
  await app.listen();
  console.log('Medical Service is listening on port 3011');
}
bootstrap();
