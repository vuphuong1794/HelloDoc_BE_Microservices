import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { NewsFavoriteService } from '../services/news-favorite.service';
import { CreateNewsFavoriteDto } from '../core/dto/news-favorite/create-news-favorite.dto';
import { GetNewsFavoriteDto } from '../core/dto/news-favorite/get-news-favorite.dto';

@Controller('news')
export class NewsFavoriteController {
  constructor(private readonly service: NewsFavoriteService) {}

  @Get(':newsId/favorite/get')
  async getFavoritesByNews(@Param('newsId') id: string, @Query() dto: GetNewsFavoriteDto) {
    return this.service.getNewsFavoritesByNewsId(id, dto);
  }

  @Post(':newsId/favorite/update')
  async updateFavorite(@Param('newsId') id: string, @Body() dto: CreateNewsFavoriteDto) {
    return this.service.updateNewsFavoriteByNewsId(id, dto);
  }

  @Get('user/:userId/favorite/get')
  async getFavoritesByUser(@Param('userId') userId: string) {
    return this.service.getNewsFavoritesByUserId(userId);
  }
}
