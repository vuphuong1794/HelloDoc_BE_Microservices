import { Body, Controller, Get, Param, Patch, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MessagePattern } from '@nestjs/microservices';
import { PostService } from '../services/post.service';

@Controller('post')
export class PostController {
    constructor(private readonly postService: PostService) { }

    //trong microservices sử dụng message và event
    @Get()
    async getAll(
        // @Query('limit') limit = '10',
        // @Query('skip') skip = '0'
    ) {
        // const limitNum = parseInt(limit);
        // const skipNum = parseInt(skip);
        return this.postService.getAll();
    }


}
