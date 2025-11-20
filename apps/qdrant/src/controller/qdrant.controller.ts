import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { QdrantService } from '../service/qdrant.service';

@Controller()
export class QdrantController {
  constructor(private readonly qdrantService: QdrantService) {}

  @MessagePattern('qdrant.upsert-post')
  async upsertPost(postId: string, vector: any, payload: any) {
    await this.qdrantService.upsertPost(postId, vector, payload);
  }

  @MessagePattern('qdrant.find-similar-posts')
  async findSimilarPostsQdrant(
      @Payload ("queryVector") queryVector: number[],
      @Payload ("limit") limit = 5,
      @Payload ("minSimilarity") minSimilarity = 0.5,
  ) {
    await this.qdrantService.findSimilarPostsQdrant(queryVector, limit, minSimilarity);
  }
}
