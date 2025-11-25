import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateNewsCommentDto } from '../core/dto/news-comment/create-news-comment.dto';
import { UpdateNewsCommentDto } from '../core/dto/news-comment/update-news-comment.dto';

@Injectable()
export class NewsCommentService {
  constructor(
    @Inject('NEWS_COMMENT_CLIENT') private readonly newsCommentClient: ClientProxy,
  ) {}

  async create(newsId: string, dto: CreateNewsCommentDto) {
    return await firstValueFrom(
      this.newsCommentClient.send('news-comment.create', { newsId, dto }),
    );
  }

  async findByNews(newsId: string) {
    return await firstValueFrom(
      this.newsCommentClient.send('news-comment.find-by-news', newsId),
    );
  }

  async findByUser(userId: string) {
    return await firstValueFrom(
      this.newsCommentClient.send('news-comment.find-by-user', userId),
    );
  }

  async update(commentId: string, dto: UpdateNewsCommentDto) {
    return await firstValueFrom(
      this.newsCommentClient.send('news-comment.update', { commentId, dto }),
    );
  }

  async delete(commentId: string) {
    return await firstValueFrom(
      this.newsCommentClient.send('news-comment.delete', commentId),
    );
  }
}
