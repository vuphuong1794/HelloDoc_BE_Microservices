import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PostFavoriteService } from '../service/post-favorite.service';
import { CreatePostFavoriteDto } from '../core/dto/create-post-favorite.dto';
import { GetPostFavoriteDto } from '../core/dto/get-post-favorite.dto';

@Controller()
export class PostFavoriteController {
  constructor(private readonly postFavoriteService: PostFavoriteService) { }

  @MessagePattern('post-favorite.get-by-post')
  async getPostFavoritesByPostId(@Payload() data: { postId: string, getPostFavoriteDto: GetPostFavoriteDto }) {
    return this.postFavoriteService.getPostFavoritesByPostId(data.postId, data.getPostFavoriteDto);
  }

  @MessagePattern('post-favorite.update')
  async updatePostFavoriteByPostId(@Payload() data: { postId: string, createPostFavoriteDto: CreatePostFavoriteDto }) {
    return this.postFavoriteService.updatePostFavoriteByPostId(data.postId, data.createPostFavoriteDto);
  }

  @MessagePattern('post-favorite.get-by-user')
  async getPostFavoritesByUserId(@Payload() data: { userId: string }) {
    console.log('post favorite controller')
    return this.postFavoriteService.getPostFavoritesByUserId(data.userId);
  }
}
