import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Express } from 'express';
import { Model } from 'mongoose';
import { In } from 'typeorm';
import { CloudinaryService } from 'libs/cloudinary/src/service/cloudinary.service';
import { CacheService } from 'libs/cache.service';
import { Post } from '../core/schema/post.schema';
import { Doctor } from 'apps/doctor/src/core/schema/doctor.schema';
import { User } from 'apps/users/src/core/schema/user.schema';
import { lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class PostService {
    private readonly logger = new Logger(PostService.name);
    constructor(
        @InjectModel(User.name, 'postConnection') private userModel: Model<User>,
        @InjectModel(Doctor.name, 'postConnection') private doctorModel: Model<Doctor>,
        @InjectModel(Post.name, 'postConnection') private postModel: Model<Post>,
        private cloudinaryService: CloudinaryService,
        private cacheService: CacheService,
    ) { }
    //  private async findOwnerById(ownerId: string): Promise<User | Doctor> {
    //     try {
    //         const owner = await this.userModel.findById(ownerId).lean() ||
    //             await this.doctorModel.findById(ownerId).lean();

    //         if (!owner) {
    //             throw new NotFoundException(`Không tìm thấy người dùng với id ${ownerId}`);
    //         }
    //         return owner;
    //     } catch (error) {
    //         this.logger.error(`Error finding owner: ${error.message}`);
    //         throw new InternalServerErrorException('Lỗi khi tìm người dùng');
    //     }
    // }

    // async create(createPostDto: CreatePostDto): Promise<Post> {
    //     let savedPost: Post;
    //     try {
    //         const uploadedMediaUrls: string[] = [];

    //         // Upload từng ảnh nếu có
    //         if (createPostDto.images && createPostDto.images.length > 0) {
    //             for (const file of createPostDto.images) {
    //                 try {
    //                     const uploadResult = await this.cloudinaryService.uploadFile(
    //                         file,
    //                         `Posts/${createPostDto.userId}`
    //                     );
    //                     uploadedMediaUrls.push(uploadResult.secure_url);
    //                     this.logger.log(`Ảnh đã tải lên Cloudinary: ${uploadResult.secure_url}`);
    //                 } catch (error) {
    //                     this.logger.error('Lỗi Cloudinary khi upload media:', error);
    //                     throw new BadRequestException('Lỗi khi tải media lên Cloudinary');
    //                 }
    //             }
    //         }

    //         const nowVN = dayjs().add(7, "hour").toDate();

    //         // Tạo document post mới
    //         const postData = new this.postModel({
    //             user: createPostDto.userId,
    //             userModel: createPostDto.userModel,
    //             content: createPostDto.content,
    //             media: uploadedMediaUrls,
    //             keywords: createPostDto.keywords || '',
    //             isHidden: false,

    //             embedding: [],
    //             embeddingModel: '',
    //             embeddingUpdatedAt: null,

    //             createdAt: nowVN,
    //             updatedAt: nowVN
    //         });

    //         savedPost = await postData.save();

    //         this.logger.log(`Post created successfully with ID: ${savedPost._id}`);

    //         // Tạo embedding async (không block quá trình create)
    //         this.generateEmbeddingAsync(savedPost._id.toString(), savedPost.keywords, savedPost.content);

    //         return savedPost;
    //     } catch (error) {
    //         this.logger.error('Error creating post:', error);
    //         throw new InternalServerErrorException('Lỗi khi tạo bài viết');
    //     }
    // }

    async getAll(limit: number, skip: number): Promise<{ posts: Post[]; hasMore: boolean; total: number }> {
        try {
            const total = await this.postModel.countDocuments({
                $or: [{ isHidden: false }, { isHidden: { $exists: false } }],
            });

            const posts = await this.postModel
                .find({ $or: [{ isHidden: false }, { isHidden: { $exists: false } }] })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({
                    path: 'user',
                    select: 'name imageUrl avatarURL',
                })
                .exec();

            const hasMore = skip + posts.length < total;

            return { posts, hasMore, total };
        } catch (error) {
            this.logger.error('Error getting paginated posts:', error);
            throw new InternalServerErrorException('Lỗi khi lấy danh sách bài viết');
        }
    }

    async search(query: string) {
        return this.postModel.find({
            $and: [
                {
                    $or: [
                        { content: { $regex: query, $options: 'i' } },
                        { keywords: { $regex: query, $options: 'i' } }
                    ]
                },
                {
                    $or: [{ isHidden: false }, { isHidden: { $exists: false } }]
                }
            ]
        })
            .limit(5)
            .populate('user', '_id name avatarURL');
    }

    async getOne(id: string): Promise<Post> {
        try {
            const post = await this.postModel
                .findById(id)
                .populate({
                    path: 'user',
                    select: 'name avatarURL',
                })
                .exec();

            if (!post) {
                throw new NotFoundException(`Không tìm thấy bài viết với id ${id}`);
            }
            return post;
        } catch (error) {
            this.logger.error('Error getting post:', error);
            throw new InternalServerErrorException('Lỗi khi lấy bài viết');
        }
    }

    async deleteCache(ownerId: string) {
        try {
            const cacheKey = `posts_by_owner_${ownerId}`;
            await this.cacheService.deleteCache(cacheKey);
        } catch (error) {
            this.logger.error('Error deleting cache:', error);
        }
    }

    private async findOwnerById(ownerId: string): Promise<{ data: any; model: 'User' | 'Doctor' }> {
        try {
            const user = await this.userModel.findById(ownerId).lean();
            if (user) return { data: user, model: 'User' };

            const doctor = await this.doctorModel.findById(ownerId).lean();
            if (doctor) return { data: doctor, model: 'Doctor' };

            throw new NotFoundException(`Không tìm thấy người dùng với id ${ownerId}`);
        } catch (error) {
            this.logger.error(`Error finding owner: ${error.message}`);
            throw new InternalServerErrorException('Lỗi khi tìm người dùng');
        }
    }


    async getByUserId(
        ownerId: string,
        limit: number,
        skip: number
    ): Promise<{ posts: Post[]; hasMore: boolean; total: number }> {
        try {
            const { model: ownerModel } = await this.findOwnerById(ownerId);
            const filter = {
                user: ownerId,
                userModel: ownerModel,
                $or: [{ isHidden: false }, { isHidden: { $exists: false } }],
            };

            const total = await this.postModel.countDocuments(filter);
            const user = await lastValueFrom(
                this.userModel.send('user.user')
            )

            const posts = await lastValueFrom(this.postModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({
                    path: 'user',
                    model: ownerModel,
                    select: 'name avatarURL',
                }).pipe(timeout(3000)));
            
            console.log(posts);

            const hasMore = skip + posts.length < total;
            return { posts, hasMore, total };

        } catch (error) {
            this.logger.error('Error getting posts by owner:', error);
            throw new InternalServerErrorException('Lỗi khi lấy bài viết của người dùng');
        }
    }
}
