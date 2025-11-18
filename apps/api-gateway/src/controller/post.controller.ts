import { Body, Controller, Get, Post, Param, Patch, Delete, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MessagePattern } from '@nestjs/microservices';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreatePostDto } from '../core/dto/post/createPost.dto';
import { PostService } from '../services/post.service';

@Controller('post')
export class PostController {
    constructor(private readonly postService: PostService) { }

    //trong microservices sử dụng message và event
    @Post('create')
    @UseInterceptors(FilesInterceptor('images'))
    async createPost(
      @UploadedFiles() files: Express.Multer.File[],
      @Body() createPostDto: CreatePostDto,
    ) {
      if (files && files.length > 0) {
        createPostDto.images = files;
      }
      return this.postService.create(createPostDto, files);
    }

    @Get()
    async getAll(
        // @Query('limit') limit = '10',
        // @Query('skip') skip = '0'
    ) {
        // const limitNum = parseInt(limit);
        // const skipNum = parseInt(skip);
        return this.postService.getAll();
    }

  @Get('search')
  async searchPost(@Query('q') query: string) {
    return this.postService.search(query);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.postService.getOne(id);
  }

  @Get('get-by-user-id/:id')
  async getByUserId(
    @Param('id') id: string,
    @Query('limit') limit = '10',
    @Query('skip') skip = '0',
  ) {
    const limitNum = parseInt(limit);
    const skipNum = parseInt(skip);
    return this.postService.getByUserId(id, limitNum, skipNum);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.postService.delete(id);
  }
}
