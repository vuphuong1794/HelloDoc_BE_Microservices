import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateNewsFavoriteDto } from '../core/dto/news-favorite/create-news-favorite.dto';
import { GetNewsFavoriteDto } from '../core/dto/news-favorite/get-news-favorite.dto';

@Injectable()
export class NewsFavoriteService {
  constructor(
    @Inject('NEWS_FAVORITE_CLIENT') private readonly newsFavoriteClient: ClientProxy,
  ) {}

  async getNewsFavoritesByNewsId(newsId: string, dto: GetNewsFavoriteDto) {
    return await firstValueFrom(
      this.newsFavoriteClient.send('news-favorite.get-by-news', { newsId, dto }),
    );
  }

  async updateNewsFavoriteByNewsId(newsId: string, dto: CreateNewsFavoriteDto) {
    return await firstValueFrom(
      this.newsFavoriteClient.send('news-favorite.update', { newsId, dto }),
    );
  }

  async getNewsFavoritesByUserId(userId: string) {
    return await firstValueFrom(
      this.newsFavoriteClient.send('news-favorite.get-by-user', { userId }),
    );
  }
}
