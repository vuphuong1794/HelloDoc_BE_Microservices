import { Injectable, InternalServerErrorException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PostFavorite } from '../core/schema/post-favorite.schema';
import { CreatePostFavoriteDto } from '../core/dto/create-post-favorite.dto';
import { GetPostFavoriteDto } from '../core/dto/get-post-favorite.dto';
import { ClientProxy } from '@nestjs/microservices';
import * as admin from 'firebase-admin';
import { firstValueFrom, lastValueFrom, timeout } from 'rxjs';
import * as dayjs from 'dayjs';

@Injectable()
export class PostFavoriteService {
  constructor(
    @InjectModel(PostFavorite.name, 'postFavoriteConnection') private postFavoriteModel: Model<PostFavorite>,
    @Inject('USERS_CLIENT') private usersClient: ClientProxy,
    @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
    @Inject('POST_CLIENT') private postClient: ClientProxy,
    @Inject('NOTIFICATION_CLIENT') private notificationClient: ClientProxy,
  ) {}

  async getPostFavoritesByPostId(postId: string, getPostFavoriteDto: GetPostFavoriteDto) {
    try {
      const postFavorite = await this.postFavoriteModel.findOne({
        user: getPostFavoriteDto.userId,
        post: postId,
      });

      const totalFavorites = await this.postFavoriteModel.countDocuments({ post: postId });

      return {
        isFavorited: !!postFavorite,
        totalFavorites,
      };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi lấy thông tin lượt yêu thích bài viết');
    }
  }

  async updatePostFavoriteByPostId(postId: string, createPostFavoriteDto: CreatePostFavoriteDto) {
    try {
      const postFavorite = await this.postFavoriteModel.findOne({
        user: createPostFavoriteDto.userId,
        post: postId,
      });

      if (postFavorite) {
        // Unlike
        await this.postFavoriteModel.deleteOne({ _id: postFavorite._id });
        const totalFavorites = await this.postFavoriteModel.countDocuments({ post: postId });
        return { isFavorited: false, totalFavorites };
      } else {
        // Like
        await this.postFavoriteModel.create({
          user: createPostFavoriteDto.userId,
          userModel: createPostFavoriteDto.userModel,
          post: postId,
        });

        const post = await lastValueFrom(
              this.postClient.send('post.get-by-post-id', { id: postId }).pipe(timeout(3000))
            );
        if (!post) {
          console.warn(`Bài viết với ID ${postId} không tồn tại`);
          return;
        }

        const userId = post?.user instanceof Object ? post?.user.toString() : post?.user;
        const userModel = post?.userModel;
        
        if (userId != createPostFavoriteDto.userId) {
          let user;
          if (createPostFavoriteDto.userModel == "Doctor") {
            // user = await this.doctorModel.findById(createPostFavoriteDto.userId);
            user = await lastValueFrom(
              this.doctorClient.send('doctor.get-by-id', createPostFavoriteDto.userId).pipe(timeout(3000))
            );
          } else if (createPostFavoriteDto.userModel == "User") {
            user = await firstValueFrom(
                this.usersClient.send('user.getuserbyid', createPostFavoriteDto.userId).pipe(timeout(3000))
            );
          }
          const username = user?.name;
          this.notifyFavorite(userId, userModel, `${username} đã thích bài viết của bạn`, postId);
        }
        const totalFavorites = await this.postFavoriteModel.countDocuments({ post: postId });
        return { isFavorited: true, totalFavorites };
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật favorite:', error);
      throw new InternalServerErrorException('Không thể cập nhật trạng thái yêu thích');
    }
  }

  async getPostFavoritesByUserId(userId: string) {
    try {
      console.log('Before get post favorites')
      const postFavorites = await this.postFavoriteModel.find({ user: userId })
        .populate({
          path: 'post',
          select: 'media content',
        })
        .populate({
          path: 'user',
          select: 'name avatarURL'
        })
        .exec();

      return postFavorites;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu thích:', error);
      throw new InternalServerErrorException('Không thể lấy danh sách yêu thích');
    }
  }

  async notifyFavorite(userId: string, userModel: string, message: string, postId: string) {
    try {
      // Create notification via Notification Service
      const notification = {
        userId: userId,
        userModel: userModel,
        type: 'ForPost',
        content: message,
        navigatePath: `post-detail/${postId}`,
      };

      await this.notificationClient.send('notification.create', notification);

      // Send FCM
      if (userModel == 'User') {
        await this.usersClient.send('user.notify', { userId, message });
        console.log(`Đã gửi thông báo đến người dùng ${userId}`);
      } else if (userModel == 'Doctor') {
        await this.doctorClient.send('doctor.notify', { userId, message });
        console.log(`Đã gửi thông báo đến bác sĩ ${userId}`);
      }
    } catch (error) {
      console.error(`Lỗi khi gửi thông báo đến ${userId}:`, error);
    }
  }
}
