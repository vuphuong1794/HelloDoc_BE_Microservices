import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PostCommentService } from '../services/post-comment.service';
import { CreatePostCommentDto } from '../core/dto/post-comment/create-post-comment.dto';
import { UpdatePostCommentDto } from '../core/dto/post-comment/update-post-comment.dto';

@Controller('post')
export class PostCommentController {
  constructor(private readonly postCommentService: PostCommentService) {}

  @Post(':postId/comment/create')
  async createCommentByPostId(
    @Param('postId') postId: string,
    @Body() createPostCommentDto: CreatePostCommentDto
  ) {
    return this.postCommentService.createCommentByPostId(postId, createPostCommentDto);
  }

  @Get(':postId/comment/get')
  async getCommentsByPostId(
    @Param('postId') postId: string,
    @Query('limit') limit = '10',
    @Query('skip') skip = '0',
  ) {
    const limitNum = parseInt(limit);
    const skipNum = parseInt(skip);
    return this.postCommentService.getCommentsByPostId(postId, limitNum, skipNum);
  }

  @Get('user/:userId/comment/get')
  async getCommentByUserId(@Param('userId') userId: string) {
    return this.postCommentService.getCommentByUserId(userId);
  }

  @Patch(':commentId/comment/update')
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() updatePostCommentDto: UpdatePostCommentDto
  ) {
    return this.postCommentService.update(commentId, updatePostCommentDto);
  }

  @Delete(':commentId/comment/delete')
  async removeComment(@Param('commentId') commentId: string) {
    return this.postCommentService.remove(commentId);
  }
}
