import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NewsCommentService } from '../service/news-comment.service';
import { CreateNewsCommentDto } from '../core/dto/create-news-comment.dto';
import { UpdateNewsCommentDto } from '../core/dto/update-news-comment.dto';

@Controller()
export class NewsCommentController {
  constructor(private readonly newsCommentService: NewsCommentService) {}

  @MessagePattern('news-comment.create')
  async create(@Payload() data: { newsId: string, dto: CreateNewsCommentDto }) {
    return this.newsCommentService.create(data.newsId, data.dto);
  }

  @MessagePattern('news-comment.find-by-news')
  async findByNews(@Payload() newsId: string) {
    return this.newsCommentService.findByNews(newsId);
  }

  @MessagePattern('news-comment.find-by-user')
  async findByUser(@Payload() userId: string) {
    return this.newsCommentService.findByUser(userId);
  }

  @MessagePattern('news-comment.update')
  async update(@Payload() data: { commentId: string, dto: UpdateNewsCommentDto }) {
    return this.newsCommentService.update(data.commentId, data.dto);
  }

  @MessagePattern('news-comment.delete')
  async delete(@Payload() commentId: string) {
    return this.newsCommentService.delete(commentId);
  }
}
