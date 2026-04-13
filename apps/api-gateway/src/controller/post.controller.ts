import { Body, Controller, Get, Post, Param, Patch, Delete, Query, UploadedFiles, UseInterceptors, Req, ValidationPipe, UsePipes } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreatePostDto } from '../core/dto/post/createPost.dto';
import { UpdatePostDto, UpdateKeywordsDto } from '../core/dto/post/updatePost.dto';
import { PostService } from '../services/post.service';
import { GetPostsDto } from '../core/dto/post/getPost.dto';

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
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAll(@Query() data: GetPostsDto) {
    const limit = data.limit ?? 10;
    const skip = data.skip ?? 0;
    console.log("Received getAll with parameters:", data.limit, data.skip);
    console.log("limit =", limit, "skip =", skip);
    console.log("Type of limit:", typeof limit);
    console.log("Type of skip:", typeof skip);
    return this.postService.getAll(limit, skip);
  }

  @Get('get-all-filtered')
  async getAllWithFilter(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('searchText') searchText?: string,
  ) {
    return this.postService.getAllWithFilter(limit, offset, searchText);
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

 @Patch(':id')
  @UseInterceptors(FilesInterceptor('images'))
  async updatePost(
    @Param('id') id: string,
    @UploadedFiles() images: Express.Multer.File[],
    @Body() body: any, // Lấy raw body text do Multer bóc ra
  ) {
    // Khởi tạo DTO mới để tránh map thiếu field
    const updatePostDto: UpdatePostDto = {
      id, // Gán id từ param
      content: undefined, // Khởi tạo content là undefined, sẽ gán nếu có trong body
      media: undefined, // Khởi tạo media là undefined, sẽ gán nếu có trong body
      images: undefined, // Khởi tạo images là undefined, sẽ gán nếu có file mới
    };

    // 1. Lấy content
    if (body.content) {
      updatePostDto.content = body.content;
    }

    // 2. Xử lý media (ảnh cũ) từ form-data
    // Multer sẽ tự gom các trường cùng tên "media" lại:
    // - Gửi > 1 url: body.media là Array ['url1', 'url2']
    // - Gửi 1 url: body.media là String 'url1'
    if (body.media) {
      if (Array.isArray(body.media)) {
        updatePostDto.media = body.media;
      } else if (typeof body.media === 'string') {
        updatePostDto.media = [body.media];
      }
    } else {
      updatePostDto.media = []; // Khởi tạo mảng rỗng nếu frontend không gửi
    }

    // Gán file images mới vào (chỉ dùng ở service nếu cần)
    // Lưu ý: Thường DTO chỉ chứa string/number, việc xử lý upload file nên nhường cho Service
    // Nếu DTO của bạn chấp nhận mảng File thì gán như cũ:
    // if (images?.length) updatePostDto.images = images;

    return this.postService.update(id, updatePostDto, images);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.postService.delete(id);
  }

  @Get('search/advanced')
  async searchPostAdvanced(@Query('query') query: string) {
    console.log('Advanced search query:', query);
    return this.postService.searchPosts(query);
  }

  @Get(':id/similar')
  async findSimilarPosts(
    @Param('id') id: string,
    @Query('limit') limit: number = 10,
    @Query('minSimilarity') minSimilarity: number = 0.7
  ) {
    return this.postService.findSimilarPosts(id, Number(limit), Number(minSimilarity));
  }

}
