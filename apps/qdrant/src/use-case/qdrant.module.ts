import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { QdrantController } from '../controller/qdrant.controller';
import { QdrantService } from '../service/qdrant.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
  
    
  ],
  controllers: [QdrantController],
  providers: [QdrantService],
})
export class QdrantModule {}
