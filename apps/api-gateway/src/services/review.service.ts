import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateReviewDto } from '../core/dto/review/create-review.dto';
import { UpdateReviewDto } from '../core/dto/review/update-review.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ReviewService {
  constructor(
    @Inject('REVIEW_CLIENT') private readonly reviewClient: ClientProxy,
  ) {}

  async createReview(data: CreateReviewDto) {
    return firstValueFrom(
      this.reviewClient.send('create_review', data)
    );
  }

  async getReviewsByDoctor(doctorId: string) {
    return firstValueFrom(
      this.reviewClient.send('get_reviews_by_doctor', doctorId)
    );
  }

  async updateReview(reviewId: string, body: UpdateReviewDto) {
    return firstValueFrom(
      this.reviewClient.send('update_review', { reviewId, body })
    );
  }

  async deleteReview(reviewId: string) {
    return firstValueFrom(
      this.reviewClient.send('delete_review', reviewId)
    );
  }
}
