import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { News } from '../core/schema/news.schema';
import { CreateNewsDto } from '../core/dto/createNews.dto';
import { UpdateNewsDto } from '../core/dto/updateNews.dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name, 'newsConnection') private newsModel: Model<News>,
    @Inject('CLOUDINARY_CLIENT') private cloudinaryClient: ClientProxy) { }

  async getAll(): Promise<News[]> {
    return await this.newsModel.find({ isHidden: false }).sort({ createdAt: -1 }).exec();
  }

  async getOne(id: string): Promise<News> {
    const news = await this.newsModel.findById(id).exec();
    if (!news) throw new NotFoundException('Không tìm thấy tin tức');
    return news;
  }
  async update(id: string, updateDto: UpdateNewsDto): Promise<News> {
    console.log('updateDto', updateDto);

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const Id = new Types.ObjectId(id);

    const news = await this.newsModel.findById(Id);
    if (!news) throw new NotFoundException('Tin tức không tồn tại');

    const uploadedMediaUrls: string[] = [];

    if (updateDto.images && updateDto.images.length > 0) {
      for (const imageData of updateDto.images) {
        try {
          console.log(`Uploading image: ${imageData.originalname}`);

          // Gửi Base64 string tới Cloudinary service
          const upload = await this.cloudinaryClient
            .send('cloudinary.upload', {
              buffer: imageData.buffer, // Base64 string
              filename: imageData.originalname,
              mimetype: imageData.mimetype,
              folder: `News/${news.admin}`,
            })
            .toPromise();

          console.log(`Upload success: ${upload.secure_url}`);
          uploadedMediaUrls.push(upload.secure_url);
        } catch (error) {
          console.error(
            `Error uploading image ${imageData.originalname}:`,
            error.message,
          );
          throw new InternalServerErrorException(
            `Failed to upload image ${imageData.originalname}: ${error.message}`,
          );
        }
      }

      // Nếu có ảnh upload, cập nhật media
      news.media = uploadedMediaUrls;
    }
    // Giữ media cũ nếu FE gửi lại
    else if (updateDto.media && updateDto.media.length > 0) {
      news.media = updateDto.media;
    }

    if (updateDto.title) news.title = updateDto.title;
    if (updateDto.content) news.content = updateDto.content;

    // Lưu document
    return await news.save();
  }


  async delete(id: string): Promise<{ message: string }> {
    const updated = await this.newsModel.findByIdAndUpdate(id, { isHidden: true }, { new: true });
    if (!updated) throw new NotFoundException('Tin tức không tồn tại');
    return { message: 'Đã ẩn tin tức thành công' };
  }
}
