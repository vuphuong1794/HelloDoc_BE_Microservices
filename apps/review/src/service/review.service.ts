import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Review, ReviewDocument } from '../core/schema/review.schema';
import { CreateReviewDto } from '../core/dto/create-review.dto';
import { UpdateReviewDto } from '../core/dto/update-review.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name, 'reviewConnection') private reviewModel: Model<ReviewDocument>,
    @Inject('USERS_CLIENT') private readonly usersClient: ClientProxy,
  ) {}

  async createReview(data: CreateReviewDto) {
    const review = new this.reviewModel({
      user: data.userId,
      doctor: data.doctorId,
      rating: data.rating,
      comment: data.comment,
    });
    return review.save();
  }

  async getReviewsByDoctor(doctorId: string) {
    const reviews = await this.reviewModel
      .find({ doctor: doctorId })
      .sort({ createdAt: -1 })
      .lean();

    console.log('reviews: ', reviews);

    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        let userData = null;
        try {
          userData = await firstValueFrom(
            this.usersClient.send('user.getuserbyid', review.user)
          );
        } catch (error) {
          console.error(`Error fetching user data: ${error.message}`);
        }

        return {
          ...review,
          user: userData || review.user,
        };
      })
    );

    return populatedReviews;
  }

  async updateReview(reviewId: string, data: UpdateReviewDto) {
    const updatedReview = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      { rating: data.rating, comment: data.comment },
      { new: true }
    );
    
    if (!updatedReview) {
        throw new NotFoundException('Review not found');
    }
    return updatedReview;
  }

  async deleteReview(reviewId: string) {
    const result = await this.reviewModel.findByIdAndDelete(reviewId);
    if (!result) {
        throw new NotFoundException('Review not found');
    }
    return result;
  }
}
