import { NestFactory } from '@nestjs/core';
import { AppointmentModule } from './use-case/appointment.module';

async function bootstrap() {
  const app = await NestFactory.create(AppointmentModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
