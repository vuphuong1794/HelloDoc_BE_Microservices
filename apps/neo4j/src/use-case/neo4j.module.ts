import { Module } from '@nestjs/common';
import { Neo4jController } from '../controller/neo4j.controller';
import { Neo4jService } from '../service/neo4j.service';
import { ConfigModule } from '@nestjs/config';
import config from 'apps/config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
  ],
  controllers: [Neo4jController],
  providers: [Neo4jService],
})
export class Neo4jModule {}
