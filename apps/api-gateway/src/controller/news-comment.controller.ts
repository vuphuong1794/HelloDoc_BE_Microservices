import { Controller, Post, Get, Patch, Delete, Body, Param } from '@nestjs/common';
import { NewsCommentService } from '../services/news-comment.service';
import { CreateNewsCommentDto } from '../core/dto/news-comment/create-news-comment.dto';
import { UpdateNewsCommentDto } from '../core/dto/news-comment/update-news-comment.dto';

@Controller('news')
export class NewsCommentController {
  constructor(private readonly newsCommentService: NewsCommentService) { }

  @Post(':newsId/comment/create')
  create(@Param('newsId') newsId: string, @Body() dto: CreateNewsCommentDto) {
    return this.newsCommentService.create(newsId, dto);
  }

  @Get(':newsId/comment')
  findByNews(@Param('newsId') newsId: string) {
    return this.newsCommentService.findByNews(newsId);
  }

  @Get('user/:userId/comment')
  findByUser(@Param('userId') userId: string) {
    return this.newsCommentService.findByUser(userId);
  }

  @Patch(':commentId/comment/update')
  update(@Param('commentId') commentId: string, @Body() dto: UpdateNewsCommentDto) {
    return this.newsCommentService.update(commentId, dto);
  }

  @Delete(':commentId/comment/delete')
  delete(@Param('commentId') commentId: string) {
    return this.newsCommentService.delete(commentId);
  }
}
