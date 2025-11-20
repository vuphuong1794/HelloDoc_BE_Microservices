import { Module } from '@nestjs/common';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
})
export class EmbeddingModule {}
