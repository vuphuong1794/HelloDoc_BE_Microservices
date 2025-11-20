import { Body, Controller, Get, Inject, InternalServerErrorException, NotFoundException, Param, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { NewsService } from '../service/news.service';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateNewsDto } from '../core/dto/createNews.dto';
import { InjectModel } from '@nestjs/mongoose';
import { News } from '../core/schema/news.schema';
import { Model } from 'mongoose';
import { UpdateNewsDto } from '../core/dto/updateNews.dto';

@Controller()
export class NewsController {
  constructor(
    @Inject('CLOUDINARY_CLIENT') private cloudinaryClient: ClientProxy,

    @InjectModel(News.name, 'newsConnection') private newsModel: Model<News>,
    private readonly newsService: NewsService
  ) { }

  @MessagePattern('news.get-all')
  async getAllNews() {
    return this.newsService.getAll();
  }

  @MessagePattern('news.create')
  async create(@Payload() dto: CreateNewsDto) {
    try {
      const uploadedMediaUrls: string[] = [];

      //console.log('Received DTO:', dto);

      if (dto.images && dto.images.length > 0) {
        for (const imageData of dto.images) {
          try {
            // Convert Base64 string thành Buffer
            const buffer = Buffer.from(imageData.buffer, 'base64');

            console.log(`Uploading image: ${imageData.originalname}`);

            // Gửi Base64 string (không phải Buffer) tới Cloudinary service
            const upload = await this.cloudinaryClient
              .send('cloudinary.upload', {
                buffer: imageData.buffer, // Gửi Base64 string, không phải Buffer!
                filename: imageData.originalname,
                mimetype: imageData.mimetype,
                folder: `News/${dto.adminId}`,
              })
              .toPromise();

            console.log(`Upload success: ${upload.secure_url}`);
            uploadedMediaUrls.push(upload.secure_url);
          } catch (error) {
            console.error(
              `Error uploading image ${imageData.originalname}:`,
              error.message,
            );
            throw new Error(
              `Failed to upload image ${imageData.originalname}: ${error.message}`,
            );
          }
        }
      }

      console.log('All images uploaded:', uploadedMediaUrls);

      // Tạo news document
      const created = new this.newsModel({
        admin: dto.adminId,
        title: dto.title,
        content: dto.content,
        media: uploadedMediaUrls,
      });

      const saved = await created.save();
      console.log('News created with ID:', saved._id);

      return saved;
    } catch (error) {
      console.error('Error in news.create:', error);
      throw new InternalServerErrorException(error.message);
    }
  }


  @MessagePattern('news.get-by-id')
  async getById(id: string) {
    return this.newsService.getOne(id);
  }

  @MessagePattern('news.update')
  async update(@Payload() id: string, @Payload() dto: UpdateNewsDto) {
    return this.newsService.update(id, dto);
  }

  @MessagePattern('news.delete')
  async delete(id: string): Promise<{ message: string }> {
    const updated = await this.newsModel.findByIdAndUpdate(id, { isHidden: true }, { new: true });
    if (!updated) throw new NotFoundException('Tin tức không tồn tại');
    return { message: 'Đã ẩn tin tức thành công' };
  }


}
