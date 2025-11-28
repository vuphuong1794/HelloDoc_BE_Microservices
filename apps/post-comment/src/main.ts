import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { PostCommentModule } from './use-case/post-comment.module';
import * as dotenv from 'dotenv';

async function bootstrap() {
  dotenv.config();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PostCommentModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3019,
      },
    },
  );
  await app.listen();
  console.log('Post Comment service is listening on port 3019');
}
bootstrap();
