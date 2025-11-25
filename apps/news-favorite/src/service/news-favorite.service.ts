import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NewsFavorite } from '../core/schema/news-favorite.schema';
import { CreateNewsFavoriteDto } from '../core/dto/create-news-favorite.dto';
import { GetNewsFavoriteDto } from '../core/dto/get-news-favorite.dto';

@Injectable()
export class NewsFavoriteService {
  constructor(
    @InjectModel(NewsFavorite.name, 'newsFavoriteConnection') private newsFavoriteModel: Model<NewsFavorite>,
  ) {}

  async getNewsFavoritesByNewsId(newsId: string, dto: GetNewsFavoriteDto) {
    try {
      const favorite = await this.newsFavoriteModel.findOne({ user: dto.userId, news: newsId });
      const total = await this.newsFavoriteModel.countDocuments({ news: newsId });
      return { isFavorited: !!favorite, totalFavorites: total };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi lấy thông tin lượt yêu thích tin tức');
    }
  }

  async updateNewsFavoriteByNewsId(newsId: string, dto: CreateNewsFavoriteDto) {
    try {
      const favorite = await this.newsFavoriteModel.findOne({ user: dto.userId, news: newsId });

      if (favorite) {
        await this.newsFavoriteModel.deleteOne({ _id: favorite._id });
      } else {
        await this.newsFavoriteModel.create({ user: dto.userId, userModel: dto.userModel, news: newsId });
      }

      const total = await this.newsFavoriteModel.countDocuments({ news: newsId });
      return { isFavorited: !favorite, totalFavorites: total };
    } catch (error) {
      console.error('Lỗi khi cập nhật favorite:', error);
      throw new InternalServerErrorException('Không thể cập nhật trạng thái yêu thích');
    }
  }

  async getNewsFavoritesByUserId(userId: string) {
    try {
      return await this.newsFavoriteModel.find({ user: userId })
        .populate({ path: 'news', select: 'title media content' })
        .exec();
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu thích:', error);
      throw new InternalServerErrorException('Không thể lấy danh sách yêu thích');
    }
  }
}
