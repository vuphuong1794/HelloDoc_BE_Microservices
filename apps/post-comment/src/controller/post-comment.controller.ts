import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PostCommentService } from '../service/post-comment.service';
import { CreatePostCommentDto } from '../core/dto/create-post-comment.dto';
import { UpdatePostCommentDto } from '../core/dto/update-post-comment.dto';

@Controller()
export class PostCommentController {
  constructor(private readonly postCommentService: PostCommentService) {}

  @MessagePattern('create_comment_by_post_id')
  async createCommentByPostId(@Payload() data: { postId: string; createPostCommentDto: CreatePostCommentDto }) {
    return this.postCommentService.createCommentByPostId(data.postId, data.createPostCommentDto);
  }

  @MessagePattern('get_comments_by_post_id')
  async getCommentsByPostId(@Payload() data: { postId: string; limit: number; skip: number }) {
    return this.postCommentService.getCommentsByPostId(data.postId, data.limit, data.skip);
  }

  @MessagePattern('get_comments_by_user_id')
  async getCommentByUserId(@Payload() userId: string) {
    return this.postCommentService.getCommentByUserId(userId);
  }

  @MessagePattern('update_comment')
  async updateComment(@Payload() data: { commentId: string; updatePostCommentDto: UpdatePostCommentDto }) {
    return this.postCommentService.update(data.commentId, data.updatePostCommentDto);
  }

  @MessagePattern('delete_comment')
  async removeComment(@Payload() commentId: string) {
    return this.postCommentService.remove(commentId);
  }
}
