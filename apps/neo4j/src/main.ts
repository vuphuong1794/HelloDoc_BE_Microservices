import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Neo4jModule } from './use-case/neo4j.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    Neo4jModule,
    {
      transport: Transport.TCP,
      options: { port: 3008 }, // khác với 3004 của News
    },
  );
  await app.listen();
  console.log('Neo4j service is listening on port 3008');
}
bootstrap();