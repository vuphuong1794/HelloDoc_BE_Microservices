import { Body, Controller, Delete, Get, Param, Patch, Post, Inject } from '@nestjs/common';
import { ReviewService } from '../services/review.service';
import { CreateReviewDto } from '../core/dto/review/create-review.dto';
import { UpdateReviewDto } from '../core/dto/review/update-review.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller('review')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  @Post()
  async createReview(@Body() body: CreateReviewDto) {
    return this.reviewService.createReview(body);
  }

  @Get('doctor/:doctorId')
  async getReviewsByDoctor(@Param('doctorId') doctorId: string) {
    // const cacheKey = `reviews_by_doctor_${doctorId}`;
    // console.log('Trying to get reviews from cache...');

    // const cached = await this.cacheManager.get(cacheKey);
    // if (cached) {
    //   console.log('Cache HIT');
    //   return cached;
    // }

    // console.log('Cache MISS - querying Service');
    const data = await this.reviewService.getReviewsByDoctor(doctorId);

    // console.log('Setting cache...');
    // await this.cacheManager.set(cacheKey, data, 3600 * 1000); // Cache for 1 hour (TTL in ms for cache-manager v5+, or seconds depending on version. ApiGatewayModule uses 3600*1000 so likely ms)
    return data;
  }

  @Patch(':reviewId')
  async updateReview(
    @Param('reviewId') reviewId: string,
    @Body() body: UpdateReviewDto
  ) {
    return this.reviewService.updateReview(reviewId, body);
  }

  @Delete(':reviewId')
  async deleteReview(@Param('reviewId') reviewId: string) {
    return this.reviewService.deleteReview(reviewId);
  }
}
