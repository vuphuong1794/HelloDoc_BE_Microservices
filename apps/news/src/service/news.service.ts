import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { News } from '../core/schema/news.schema';
import { CreateNewsDto } from '../core/dto/createNews.dto';
import { UpdateNewsDto } from '../core/dto/updateNews.dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name, 'newsConnection') private newsModel: Model<News>) { }

  async getAll(): Promise<News[]> {
    return await this.newsModel.find({ isHidden: false }).sort({ createdAt: -1 }).exec();
  }

  async getOne(id: string): Promise<News> {
    const news = await this.newsModel.findById(id).exec();
    if (!news) throw new NotFoundException('Không tìm thấy tin tức');
    return news;
  }
  // async update(id: string, updateDto: UpdateNewsDto): Promise<News> {
  //   const news = await this.newsModel.findById(id);
  //   if (!news) throw new NotFoundException('Tin tức không tồn tại');

  //   const uploadedMediaUrls: string[] = [];
  //   if (updateDto.images && updateDto.images.length > 0) {
  //     for (const file of updateDto.images) {
  //       const upload = await this.cloudinaryService.uploadFile(file, `News/${news.admin}`);
  //       uploadedMediaUrls.push(upload.secure_url);
  //     }
  //     news.media = uploadedMediaUrls;
  //   } else if (updateDto.media && updateDto.media.length > 0) {
  //     news.media = updateDto.media;
  //   }

  //   if (updateDto.title) news.title = updateDto.title;
  //   if (updateDto.content) news.content = updateDto.content;

  //   return await news.save();
  // }

  async delete(id: string): Promise<{ message: string }> {
    const updated = await this.newsModel.findByIdAndUpdate(id, { isHidden: true }, { new: true });
    if (!updated) throw new NotFoundException('Tin tức không tồn tại');
    return { message: 'Đã ẩn tin tức thành công' };
  }
}
