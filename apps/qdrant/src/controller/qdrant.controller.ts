import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { QdrantService } from '../service/qdrant.service';

@Controller()
export class QdrantController {
  constructor(private readonly qdrantService: QdrantService) {}

  @MessagePattern('qdrant.upsert-post')
  async upsertPost(@Payload() data: { postId: string; vector: number[]; payload: any }) {
    const { postId, vector, payload } = data;
    return this.qdrantService.upsertPost(postId, vector, payload);
  }

  @MessagePattern('qdrant.find-similar-posts')
  async findSimilarPostsQdrant(
      @Payload() data: { queryVector: number[]; limit?: number; minSimilarity?: number }
  ) {
    const { queryVector, limit = 5, minSimilarity = 0.5 } = data;
    console.log(`QdrantController: Finding similar posts with limit ${limit} and minSimilarity ${minSimilarity}`);
    return await this.qdrantService.findSimilarPostsQdrant(queryVector, limit, minSimilarity);
  }


  // @MessagePattern('qdrant.delete-all')
  // async deleteAll() {
  //   return this.qdrantService.deleteAll();
  // }

  // @MessagePattern('qdrant.delete-by-id')
  // async deleteById(@Payload() data: { postId: string }) {
  //   const { postId } = data;
  //   return this.qdrantService.deleteById(postId);
  // }
}
