import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreatePostCommentDto } from '../core/dto/post-comment/create-post-comment.dto';
import { UpdatePostCommentDto } from '../core/dto/post-comment/update-post-comment.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PostCommentService {
  constructor(
    @Inject('POST_COMMENT_CLIENT') private readonly postCommentClient: ClientProxy,
  ) {}

  async createCommentByPostId(postId: string, createPostCommentDto: CreatePostCommentDto) {
    return firstValueFrom(
      this.postCommentClient.send('create_comment_by_post_id', { postId, createPostCommentDto })
    );
  }

  async getCommentsByPostId(postId: string, limit: number, skip: number) {
    return firstValueFrom(
      this.postCommentClient.send('get_comments_by_post_id', { postId, limit, skip })
    );
  }

  async getCommentByUserId(userId: string) {
    return firstValueFrom(
      this.postCommentClient.send('get_comments_by_user_id', userId)
    );
  }

  async update(commentId: string, updatePostCommentDto: UpdatePostCommentDto) {
    return firstValueFrom(
      this.postCommentClient.send('update_comment', { commentId, updatePostCommentDto })
    );
  }

  async remove(commentId: string) {
    return firstValueFrom(
      this.postCommentClient.send('delete_comment', commentId)
    );
  }
}
