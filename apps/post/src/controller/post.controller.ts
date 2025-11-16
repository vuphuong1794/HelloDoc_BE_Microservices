import { Body, Controller, Param, Query, Req, UploadedFiles, UseInterceptors, Payload, Ctx } from '@nestjs/common';
import { PostService } from '../service/post.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MessagePattern } from '@nestjs/microservices';
import { CreatePostDto } from '../core/dto/createPost.dto';
import { UpdatePostDto, UpdateKeywordsDto } from '../core/dto/updatePost.dto';
import { Request } from 'express';

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
  async getAll(@Payload() data: { limit: string; skip: string }) {
    const limitNum = parseInt(data.limit || '10');
    const skipNum = parseInt(data.skip || '0');
    return this.postService.getAll(limitNum, skipNum);
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

  @MessagePattern('post.find-similar')
  async findSimilarPosts(@Payload() data: { id: string; limit: number; minSimilarity: number }) {
    return this.postService.findSimilarPosts(data.id, Number(data.limit || 10), Number(data.minSimilarity || 0.7));
  }

  // ================ Hybrid Search ================
  @MessagePattern('post.hybrid-search')
  async hybridSearch(@Payload() data: { q: string; limit: number; minSimilarity: number }) {
    return this.postService.hybridSearch(data.q, Number(data.limit || 5));
  }

  @MessagePattern('post.search-advanced')
  async searchPostAdvanced(@Payload() data: { query: string }) {
    console.log('Advanced search query:', data.query);
    return this.postService.searchPosts(data.query);
  }

  @MessagePattern('post.has-keywords')
  async hasKeywords(@Payload() data: { id: string }) {
    const post = await this.postService.getOne(data.id);
    return this.postService.hasKeywords(post);
  }

  @MessagePattern('post.has-embedding')
  async hasEmbedding(@Payload() data: { id: string }) {
    const post = await this.postService.getOne(data.id);
    return this.postService.hasEmbedding(post);
  }

  //tao embedding cho tat ca bai viet
  @MessagePattern('post.generate-embedding')
  async generateEmbeddings(@Payload() data: { id: string; keywords?: string; content?: string }) {
    return this.postService.generateAndStoreEmbedding(data.id, data.keywords, data.content);
  }

  @MessagePattern('post.update-keywords')
  async updatePostKeywords(@Payload() data: { id: string; keywords: string }) {
    return this.postService.updatePostKeywords(data.id, data.keywords);
  }

  @MessagePattern('post.generate-embedding-async')
  async generateEmbedding(@Payload() data: { id: string; keywords?: string; content?: string }) {
    return this.postService.generateEmbeddingAsync(data.id, data.keywords, data.content);
  }
}
