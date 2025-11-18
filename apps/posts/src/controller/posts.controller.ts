import { Body, Controller, Param, Query, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { PostService } from '../service/post.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreatePostDto } from '../core/dto/createPost.dto';

@Controller()
export class PostController {
  constructor(private readonly postService: PostService) { }

  // @MessagePattern('post.create')
  // @UseInterceptors(FilesInterceptor('images'))
  // async createPost(
  //   @UploadedFiles()
  //   @UploadedFiles() files: Express.Multer.File[],
  //   @Body() createPostDto: CreatePostDto,
  // ) {
  //   if (files && files.length > 0) {
  //     createPostDto.images = files;
  //   }
  //   return this.postService.create(createPostDto);
  // }

  @MessagePattern('post.get-all')
  async getAll(
    @Query('limit') limit = 10,
    @Query('skip') skip = 0,) {
    return this.postService.getAll(limit, skip);
  }


  @MessagePattern('post.search')
  async searchPost(@Payload() data: { q: string }) {
    return this.postService.search(data.q);
  }

  @MessagePattern('post.get-one')
  async getOne(@Payload() data: { id: string }) {
    return this.postService.getOne(data.id);
  }

  @MessagePattern('post.get-by-user-id')
  async getByUserId(@Payload() data: { id: string; limit: string; skip: string }) {
    const limitNum = parseInt(data.limit || '10');
    const skipNum = parseInt(data.skip || '0');
    return this.postService.getByUserId(data.id, limitNum, skipNum);
  }

  // @MessagePattern('post.update')
  // @UseInterceptors(FilesInterceptor('images'))
  // async updatePost(
  //   @Param('id') id: string,
  //   @UploadedFiles() images: Express.Multer.File[],
  //   @Body() updatePostDto: UpdatePostDto,
  //   @Req() request: Request, // Add this parameter to access the request
  // ) {
  //   // Gán images từ multipart vào DTO
  //   updatePostDto.images = images;
  //   console.log(images)
  //   // Xử lý media (ảnh cũ) từ form-data
  //   // In NestJS, form-data fields (except files) are available in request.body
  //   const body = request.body as any; // Type assertion since form-data fields might not be typed

  //   // Handle media array
  //   if (body.media) {
  //     // If media is sent as array (media[0], media[1],...)
  //     if (Array.isArray(body.media)) {
  //       updatePostDto.media = body.media;
  //     }
  //     // If media is sent as string (single image case)
  //     else if (typeof body.media === 'string') {
  //       updatePostDto.media = [body.media];
  //     }
  //   }

  //   return this.postService.update(id, updatePostDto);
  // }

  // @MessagePattern('post.delete')
  // async delete(@Param('id') id: string) {
  //   return this.postService.delete(id);
  // }

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

  // @MessagePattern('post.search-advanced')
  // async searchPostAdvanced(@Query('query') query: string) {
  //   console.log('Advanced search query:', query);
  //   return this.postService.searchPosts(query);
  // }

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
