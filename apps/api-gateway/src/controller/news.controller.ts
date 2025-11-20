import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { NewsService } from '../services/news.service';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UpdateNewsDto } from 'apps/news/src/core/dto/updateNews.dto';
import { CreateNewsDto, ImageDto } from 'apps/news/src/core/dto/createNews.dto';
import { ClientProxy } from '@nestjs/microservices';

@Controller('news')
export class NewsController {
    constructor(
        private readonly newsService: NewsService,
        @Inject('NEWS_CLIENT') private newsClient: ClientProxy

    ) { }

    //trong microservices sử dụng message và event
    @Get('get-all')
    getAllNews() {
        return this.newsService.getAll();
    }

    @Get(':id')
    getAllUsers(@Param('id') id: string) {
        return this.newsService.getById(id);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.newsService.delete(id);
    }

    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
    async update(@Param('id') id: string, @UploadedFiles() files: { images?: Express.Multer.File[] }, @Body() dto: UpdateNewsDto) {
        // Chuyển đổi files sang Base64
        if (files.images && files.images.length > 0) {
            dto.images = files.images.map((file) => ({
                buffer: file.buffer.toString('base64'),
                originalname: file.originalname,
                mimetype: file.mimetype,
            } as ImageDto));
        }

        return this.newsService.update(id, dto);
    }

    @Post('create')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
    async create(
        @UploadedFiles() files: { images?: Express.Multer.File[] },
        @Body() dto: CreateNewsDto,
    ) {
        // Chuyển đổi files sang Base64
        if (files.images && files.images.length > 0) {
            dto.images = files.images.map((file) => ({
                buffer: file.buffer.toString('base64'),
                originalname: file.originalname,
                mimetype: file.mimetype,
            } as ImageDto));
        }

        //console.log('DTO before sending:', dto);

        return this.newsClient.send('news.create', dto).toPromise();
    }
}
