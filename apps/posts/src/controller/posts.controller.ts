import { Body, Controller, Param, Query, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { PostService } from '../service/post.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreatePostDto } from '../core/dto/createPost.dto';
import { UpdatePostDto, UpdateKeywordsDto } from '../core/dto/updatePost.dto';

@Controller()
export class PostController {
  constructor(private readonly postService: PostService) { }

  @MessagePattern('post.create')
  async createPost(@Payload() data: { createPostDto: CreatePostDto; files?: Express.Multer.File[] }) {
    const { createPostDto, files } = data;
    if (files && files.length > 0) {
      createPostDto.images = files;
    }
    return this.postService.create(createPostDto);
  }

  @MessagePattern('post.get-all')
  //nếu không có tham số limit và skip thì giá trị mặc định là 10 và 0
  async getAll(@Payload() data: { limit?: number; skip?: number }) {
    const limit = data.limit ?? 10;
    const skip = data.skip ?? 0;
    return this.postService.getAll(limit, skip);
  }


  @MessagePattern('post.search')
  async searchPost(@Payload() data: { q: string }) {
    return this.postService.search(data.q);
  }

  @MessagePattern('post.get-by-post-id')
  async getOne(@Payload() data: { id: string }) {
    return this.postService.getOne(data.id);
  }

  @MessagePattern('post.get-by-user-id')
  async getByUserId(@Payload() data: { id: string; limit: string; skip: string }) {
    const limitNum = parseInt(data.limit || '10');
    const skipNum = parseInt(data.skip || '0');
    return this.postService.getByUserId(data.id, limitNum, skipNum);
  }

  @MessagePattern('post.update')
  async updatePost(@Payload() data: { id: string; updatePostDto: UpdatePostDto; images?: Express.Multer.File[] }) {
    const { id, updatePostDto, images } = data;

    // Gán images từ multipart vào DTO
    if (images) {
      updatePostDto.images = images;
    }

    // Handle media array if provided in updatePostDto
    // Media should be passed directly in updatePostDto

    return this.postService.update(id, updatePostDto);
  }

  @MessagePattern('post.delete')
  async delete(@Payload() data: { id: string }) {
    return this.postService.delete(data.id);
  }

  // @MessagePattern('post.find-similar')
  // async findSimilarPosts(
  //   @Param('id') id: string,
  //   @Query('limit') limit: number = 10,
  //   @Query('minSimilarity') minSimilarity: number = 0.7
  // ) {
  //   return this.postService.findSimilarPosts(id, Number(limit), Number(minSimilarity));
  // }

  // // ================ Hybrid Search ================
  // @MessagePattern('post.hybrid-search')
  // async hybridSearch(
  //   @Query('q') query: string,
  //   @Query('limit') limit: number = 5,
  //   @Query('minSimilarity') minSimilarity: number = 0.75
  // ) {
  //   return this.postService.hybridSearch(query, Number(limit));
  // }

  @MessagePattern('post.search-advanced')
  // async searchPostAdvanced(@Query('query') query: string) {
  async searchPostAdvanced(@Payload() data: { query: string }) {
    console.log('Advanced search query:', data.query);
    return this.postService.searchPosts(data.query);
  }

  // // @Get('semantic-search/search/test')
  // // async semanticSearch(
  // //   @Query('q') query: string,
  // //   @Query('limit') limit: number = 10,
  // //   @Query('minSimilarity') minSimilarity: number = 0.7
  // // ) {
  // //   return this.postService.semanticSearch(query, Number(limit), Number(minSimilarity));
  // // }

  // @MessagePattern('post.has-keywords/:id')
  // async hasKeywords(@Param('id') id: string) {
  //   const post = await this.postService.getOne(id);
  //   return this.postService.hasKeywords(post);
  // }

  // @MessagePattern('post.has-embedding/:id')
  // async hasEmbedding(@Param('id') id: string) {
  //   const post = await this.postService.getOne(id);
  //   return this.postService.hasEmbedding(post);
  // }

  // //tao embedding cho tat ca bai viet
  // @MessagePattern('post.generate-embedding/:id')
  // async generateEmbeddings(@Param('id') id: string) {
  //   return this.postService.generateAndStoreEmbedding(id);
  // }

  // @MessagePattern('post.update-keywords/:id')
  // async updatePostKeywords(@Param('id') id: string, @Body() body: UpdateKeywordsDto) {
  //   return this.postService.updatePostKeywords(id, body.keywords);
  // }

  // @MessagePattern('post.generate-embedding-async/:id')
  // async generateEmbedding(@Body() keywords: string, @Param('id') id: string) {
  //   return this.postService.generateEmbeddingAsync(id, keywords);
  // }
}
