import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReviewService } from '../service/review.service';
import { CreateReviewDto } from '../core/dto/create-review.dto';
import { UpdateReviewDto } from '../core/dto/update-review.dto';

@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @MessagePattern('create_review')
  async createReview(@Payload() data: CreateReviewDto) {
    return this.reviewService.createReview(data);
  }

  @MessagePattern('get_reviews_by_doctor')
  async getReviewsByDoctor(@Payload() doctorId: string) {
    return this.reviewService.getReviewsByDoctor(doctorId);
  }

  @MessagePattern('update_review')
  async updateReview(@Payload() data: { reviewId: string; body: UpdateReviewDto }) {
    return this.reviewService.updateReview(data.reviewId, data.body);
  }

  @MessagePattern('delete_review')
  async deleteReview(@Payload() reviewId: string) {
    return this.reviewService.deleteReview(reviewId);
  }
}
