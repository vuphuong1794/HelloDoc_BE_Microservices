import { NestFactory } from '@nestjs/core';
import { UndertheseaModule } from './use-case/underthesea.module';

async function bootstrap() {
  const app = await NestFactory.create(UndertheseaModule);
  await app.listen(3020);
}
bootstrap();
