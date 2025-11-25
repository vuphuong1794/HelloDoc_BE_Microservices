import { Injectable, NotFoundException, InternalServerErrorException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NewsComment } from '../core/schema/news-comment.schema';
import { Model } from 'mongoose';
import { CreateNewsCommentDto } from '../core/dto/create-news-comment.dto';
import { UpdateNewsCommentDto } from '../core/dto/update-news-comment.dto';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class NewsCommentService {
    constructor(
        @InjectModel(NewsComment.name, 'newsCommentConnection') private newsCommentModel: Model<NewsComment>,
        @Inject('USERS_CLIENT') private usersClient: ClientProxy,
        @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
        @Inject('ADMIN_CLIENT') private adminClient: ClientProxy,
        @Inject('NEWS_CLIENT') private newsClient: ClientProxy,
        @Inject('NOTIFICATION_CLIENT') private notificationClient: ClientProxy,
    ) { }

    async create(newsId: string, dto: CreateNewsCommentDto) {
        try {
            let model: string;

            // Check user type via microservices
            try {
                const user = await firstValueFrom(
                    this.usersClient.send('user.getuserbyid', dto.userId).pipe(timeout(3000))
                );
                if (user) {
                    model = 'User';
                }
            } catch (error) {
                // User not found, try doctor
                try {
                    const doctor = await lastValueFrom(
                        this.doctorClient.send('doctor.get-by-id', dto.userId).pipe(timeout(3000))
                    );
                    if (doctor) {
                        model = 'Doctor';
                    }
                } catch (error) {
                    // Doctor not found, try admin
                    try {
                        const admin = await lastValueFrom(
                            this.adminClient.send('admin.get-by-id', dto.userId).pipe(timeout(3000))
                        );
                        if (admin) {
                            model = 'Admin';
                        }
                    } catch (error) {
                        throw new NotFoundException('Không tìm thấy người dùng');
                    }
                }
            }

            const comment = new this.newsCommentModel({
                user: dto.userId,
                userModel: model,
                news: newsId,
                content: dto.content,
            });

            const savedComment = await comment.save();

            // Get news info and notify the news author
            try {
                const news = await lastValueFrom(
                    this.newsClient.send('news.get-by-id', newsId).pipe(timeout(3000))
                );
                
                if (news && news.user && news.user.toString() !== dto.userId) {
                    // Get commenter info
                    let commenterName = 'Người dùng';
                    if (model === 'User') {
                        const user = await firstValueFrom(
                            this.usersClient.send('user.getuserbyid', dto.userId).pipe(timeout(3000))
                        );
                        commenterName = user?.name || 'Người dùng';
                    } else if (model === 'Doctor') {
                        const doctor = await lastValueFrom(
                            this.doctorClient.send('doctor.get-by-id', dto.userId).pipe(timeout(3000))
                        );
                        commenterName = doctor?.name || 'Bác sĩ';
                    } else if (model === 'Admin') {
                        const admin = await lastValueFrom(
                            this.adminClient.send('admin.get-by-id', dto.userId).pipe(timeout(3000))
                        );
                        commenterName = admin?.name || 'Quản trị viên';
                    }

                    const newsUserId = news.user instanceof Object ? news.user.toString() : news.user;
                    const newsUserModel = news.userModel || 'User';
                    
                    await this.notifyComment(
                        newsUserId,
                        newsUserModel,
                        `${commenterName} đã bình luận về tin tức của bạn`,
                        newsId
                    );
                }
            } catch (error) {
                console.error('Lỗi khi gửi thông báo:', error);
            }

            return savedComment;
        } catch (error) {
            console.error('Lỗi khi tạo comment:', error);
            throw new InternalServerErrorException('Không thể tạo bình luận');
        }
    }

    async findByNews(newsId: string) {
        try {
            const comments = await this.newsCommentModel.find({ news: newsId }).exec();
            
            // Populate user info via microservices
            const populatedComments = await Promise.all(
                comments.map(async (comment) => {
                    const commentObj: any = comment.toObject();
                    try {
                        let userInfo;
                        if (comment.userModel === 'User') {
                            userInfo = await firstValueFrom(
                                this.usersClient.send('user.getuserbyid', comment.user).pipe(timeout(3000))
                            );
                        } else if (comment.userModel === 'Doctor') {
                            userInfo = await lastValueFrom(
                                this.doctorClient.send('doctor.get-by-id', comment.user).pipe(timeout(3000))
                            );
                        } else if (comment.userModel === 'Admin') {
                            userInfo = await lastValueFrom(
                                this.adminClient.send('admin.get-by-id', comment.user).pipe(timeout(3000))
                            );
                        }
                        
                        if (userInfo) {
                            commentObj.user = {
                                _id: userInfo._id,
                                name: userInfo.name,
                                avatarURL: userInfo.avatarURL,
                            };
                        }
                    } catch (error) {
                        console.error(`Lỗi khi lấy thông tin user ${comment.user}:`, error);
                    }
                    return commentObj;
                })
            );

            return populatedComments;
        } catch (error) {
            console.error('Lỗi khi lấy comments:', error);
            throw new InternalServerErrorException('Không thể lấy danh sách bình luận');
        }
    }

    async findByUser(userId: string) {
        try {
            const comments = await this.newsCommentModel.find({ user: userId }).exec();
            
            // Populate news info via microservices
            const populatedComments = await Promise.all(
                comments.map(async (comment) => {
                    const commentObj: any = comment.toObject();
                    try {
                        const newsInfo = await lastValueFrom(
                            this.newsClient.send('news.get-by-id', comment.news).pipe(timeout(3000))
                        );
                        
                        if (newsInfo) {
                            commentObj.news = {
                                _id: newsInfo._id,
                                title: newsInfo.title,
                            };
                        }
                    } catch (error) {
                        console.error(`Lỗi khi lấy thông tin news ${comment.news}:`, error);
                    }
                    return commentObj;
                })
            );

            return populatedComments;
        } catch (error) {
            console.error('Lỗi khi lấy comments của user:', error);
            throw new InternalServerErrorException('Không thể lấy danh sách bình luận');
        }
    }

    async update(id: string, dto: UpdateNewsCommentDto) {
        const updated = await this.newsCommentModel.findByIdAndUpdate(id, dto, { new: true });
        if (!updated) throw new NotFoundException('Comment không tồn tại');
        return updated;
    }

    async delete(id: string) {
        const deleted = await this.newsCommentModel.findByIdAndDelete(id);
        if (!deleted) throw new NotFoundException('Comment không tồn tại');
        return { message: 'Xóa bình luận thành công' };
    }

    async notifyComment(userId: string, userModel: string, message: string, newsId: string) {
        try {
            // Create notification via Notification Service
            const notification = {
                userId: userId,
                userModel: userModel,
                type: 'ForNews',
                content: message,
                navigatePath: `news-detail/${newsId}`,
            };

            await this.notificationClient.send('notification.create', notification);

            // Send FCM via respective microservices
            if (userModel === 'User') {
                await this.usersClient.send('user.notify', { userId, message });
                console.log(`Đã gửi thông báo đến người dùng ${userId}`);
            } else if (userModel === 'Doctor') {
                await this.doctorClient.send('doctor.notify', { userId, message });
                console.log(`Đã gửi thông báo đến bác sĩ ${userId}`);
            } else if (userModel === 'Admin') {
                await this.adminClient.send('admin.notify', { userId, message });
                console.log(`Đã gửi thông báo đến admin ${userId}`);
            }
        } catch (error) {
            console.error(`Lỗi khi gửi thông báo đến ${userId}:`, error);
        }
    }
}
