import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NewsFavoriteService } from '../service/news-favorite.service';
import { CreateNewsFavoriteDto } from '../core/dto/create-news-favorite.dto';
import { GetNewsFavoriteDto } from '../core/dto/get-news-favorite.dto';

@Controller()
export class NewsFavoriteController {
  constructor(private readonly service: NewsFavoriteService) { }

  @MessagePattern('news-favorite.get-by-news')
  async getFavoritesByNews(@Payload() data: { newsId: string, dto: GetNewsFavoriteDto }) {
    return this.service.getNewsFavoritesByNewsId(data.newsId, data.dto);
  }

  @MessagePattern('news-favorite.update')
  async updateFavorite(@Payload() data: { newsId: string, dto: CreateNewsFavoriteDto }) {
    return this.service.updateNewsFavoriteByNewsId(data.newsId, data.dto);
  }

  @MessagePattern('news-favorite.get-by-user')
  async getFavoritesByUser(@Payload() data: { userId: string }) {
    return this.service.getNewsFavoritesByUserId(data.userId);
  }
}
