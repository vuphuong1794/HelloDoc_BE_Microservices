import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { EmbeddingController } from '../controller/embedding.controller';
import { EmbeddingService } from '../service/embedding.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
  ],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
})
export class EmbeddingModule {}
