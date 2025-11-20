import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { EmbeddingService } from '../service/embedding.service';

@Controller()
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @MessagePattern('embedding.generate')
  async generateEmbedding(text: string): Promise<number[]> {
    return this.embeddingService.generateEmbedding(text);
  }

  @MessagePattern('embedding.get-model-name')
  async getModelName(): Promise<string> {
    return this.embeddingService.getModelName();
  }
}
