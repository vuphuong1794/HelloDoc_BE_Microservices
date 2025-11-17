import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { PostModule } from './use-case/post.module';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        PostModule,
        {
            transport: Transport.TCP,
            options: {
                port: 3002,
            },
        },
    );
    await app.listen();
    console.log('Post service is listening on port 3002');
}
bootstrap();
