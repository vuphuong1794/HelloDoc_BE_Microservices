import { Injectable, Inject, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { PostComment, PostCommentDocument } from '../core/schema/post-comment.schema';
import { CreatePostCommentDto } from '../core/dto/create-post-comment.dto';
import { UpdatePostCommentDto } from '../core/dto/update-post-comment.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PostCommentService {
  constructor(
    @InjectModel(PostComment.name, 'postCommentConnection') private postCommentModel: Model<PostComment>,
    @Inject('USERS_CLIENT') private readonly usersClient: ClientProxy,
    @Inject('DOCTOR_CLIENT') private readonly doctorClient: ClientProxy,
    @Inject('POST_CLIENT') private readonly postClient: ClientProxy,
  ) {}

  async createCommentByPostId(postId: string, createPostCommentDto: CreatePostCommentDto) {
    try {
      // Verify post exists
      let post;
      try {
        post = await firstValueFrom(this.postClient.send('post.get-by-post-id', { id: postId }));
      } catch (e) {
        console.warn(`Bài viết với ID ${postId} không tồn tại`);
        return;
      }

      if (!post) {
        console.warn(`Bài viết với ID ${postId} không tồn tại`);
        return;
      }

      const createdPostComment = new this.postCommentModel({
        user: createPostCommentDto.userId,
        userModel: createPostCommentDto.userModel,
        post: postId,
        content: createPostCommentDto.content,
      });

      console.log("Noi dung cmt vao service la: "
        +createPostCommentDto.userId
        +" "+createPostCommentDto.userModel
      +" "+postId
      +" "+createPostCommentDto.content)

      const postUserId = post?.user instanceof Object ? post?.user.toString() : post?.user;
      const userId = post?.user instanceof Object ? post?.user.toString() : post?.user;
      const userModel = post?.userModel;

      if (userId != createPostCommentDto.userId) {
        let user;
        try {
            if (createPostCommentDto.userModel == "Doctor") {
                user = await firstValueFrom(this.doctorClient.send('doctor.get-by-id', createPostCommentDto.userId));
                console.log("User la bac si: "+user)
            } else if (createPostCommentDto.userModel == "User") {
                user = await firstValueFrom(this.usersClient.send('user.getuserbyid', createPostCommentDto.userId));
                console.log("User la nguoi dung: "+user)
            }
        } catch (e) {
            console.error("Error fetching user details", e);
        }
        
        const username = user?.name
        // Notification logic would go here, likely via another microservice call or direct FCM if moved
        // For now, we'll skip direct FCM implementation as it requires firebase-admin setup which might be in notification service
        // this.notifyComment(userId, userModel, `${username} đã bình luận bài viết của bạn`);
      }
      console.log("Gui thanh cong: "+createdPostComment)

      // Notify Notification Service
      if(userId != postUserId) {
          // await this.notificationService.createNotification(notification);
          // We would emit an event or call notification service here
      }
    
      return await createdPostComment.save();
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi tạo bình luận');
    }
  }

  async getCommentsByPostId(postId: string, limit = 10, skip = 0) {
    try {
      const postComments = await this.postCommentModel.find({ post: postId })
        .skip(skip)
        .limit(limit + 1)
        .lean();

      // Populate user details manually via ClientProxy
      const populatedComments = await Promise.all(
        postComments.map(async (comment) => {
            let userData = null;
            try {
                if (comment.userModel === 'User') {
                    console.log('User commenting')
                    userData = await firstValueFrom(this.usersClient.send('user.getuserbyid', comment.user));
                  } else if (comment.userModel === 'Doctor') {
                  console.log('Doctor commenting')
                    userData = await firstValueFrom(this.doctorClient.send('doctor.get-by-id', comment.user));
                }
            } catch (e) {
                console.error(`Error fetching user data for comment ${comment._id}:`, e);
            }
            return {
                ...comment,
                user: userData ? { _id: userData._id, name: userData.name, avatarURL: userData.avatarURL } : null
            };
        })
      );

      const filteredComments = populatedComments.filter(comment => comment.user !== null);
      const comments = filteredComments.slice(0, limit);
      const hasMore = filteredComments.length > limit;

      return {
        comments,
        hasMore
      };
    } catch (error) {
      console.error('Lỗi khi lấy bình luận:', error);
      throw new Error('Không thể lấy danh sách bình luận');
    }
  }

  async getCommentByUserId(userId: string) {
    try {
      const postComments = await this.postCommentModel.find({ user: userId }).lean();
      
      const populatedComments = await Promise.all(
        postComments.map(async (comment) => {
             // Populate post details
             let postData = null;
             try {
                 postData = await firstValueFrom(this.postClient.send('post.get-by-post-id', comment.post));
             } catch (e) {
                 console.error(`Error fetching post data for comment ${comment._id}:`, e);
             }

             // Populate user details (self)
             let userData = null;
             try {
                if (comment.userModel === 'User') {
                    userData = await firstValueFrom(this.usersClient.send('user.getuserbyid', comment.user));
                } else if (comment.userModel === 'Doctor') {
                    userData = await firstValueFrom(this.doctorClient.send('doctor.get-by-id', comment.user));
                }
             } catch (e) {
                 console.error(`Error fetching user data for comment ${comment._id}:`, e);
             }

             return {
                 ...comment,
                 post: postData ? { _id: postData._id, media: postData.media, content: postData.content } : null,
                 user: userData ? { _id: userData._id, name: userData.name, avatarURL: userData.avatarURL } : null
             }
        })
      );

      const validComments = populatedComments.filter(comment => comment.user !== null);
      return validComments;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi lấy thông tin danh sách bình luận');
    }
  }

  async update(id: string, updatePostCommentDto: UpdatePostCommentDto) {
    try {
      const updatedComment = await this.postCommentModel.findByIdAndUpdate(
        id,
        updatePostCommentDto,
        { new: true }
      );

      if (!updatedComment) {
        throw new NotFoundException(`Không tìm thấy comment với id ${id}`);
      }

      return updatedComment;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi cập nhật bình luận');
    }
  }

  async remove(id: string) {
    try {
      const deletedComment = await this.postCommentModel.findByIdAndDelete(id);

      if (!deletedComment) {
        throw new NotFoundException(`Không tìm thấy comment để xóa với id ${id}`);
      }

      return { message: 'Xóa bình luận thành công' };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi xóa bình luận');
    }
  }
}
