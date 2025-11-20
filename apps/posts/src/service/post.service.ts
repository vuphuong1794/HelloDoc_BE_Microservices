import { Inject, Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Express } from 'express';
import { Model } from 'mongoose';
import { In } from 'typeorm';
import { CreatePostDto } from '../core/dto/createPost.dto';
import { CacheService } from 'libs/cache.service';
import { Post } from '../core/schema/post.schema';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import * as dayjs from 'dayjs';

@Injectable()
export class PostService {
    private readonly logger = new Logger(PostService.name);
    constructor(
        @Inject('USERS_CLIENT') private usersClient: ClientProxy,
        @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
        @Inject('CLOUDINARY_CLIENT') private cloudinaryClient: ClientProxy,
        @InjectModel(Post.name, 'postConnection') private postModel: Model<Post>,
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

    async create(createPostDto: CreatePostDto): Promise<Post> {
        let savedPost: Post;
        try {
            const uploadedMediaUrls: string[] = [];

            // Upload từng ảnh nếu có
            if (createPostDto.images && createPostDto.images.length > 0) {
                for (const file of createPostDto.images) {
                    try {
                        console.log(`Uploading image: ${file.originalname}`);

                        // Gửi qua Cloudinary Client (RPC)
                        const uploadResult = await this.cloudinaryClient
                            .send('cloudinary.upload', {
                            buffer: file.buffer, // Base64 string
                            filename: file.originalname,
                            mimetype: file.mimetype,
                            folder: `Post/${createPostDto.userId}/Image`,
                            })
                            .toPromise();

                        console.log(`Upload success: ${uploadResult.secure_url}`);
                        uploadedMediaUrls.push(uploadResult.secure_url);
                        } catch (error) {
                        console.error(
                            `Error uploading image ${file.originalname}:`,
                            error.message,
                        );
                        throw new Error(
                            `Failed to upload image ${file.originalname}: ${error.message}`,
                        );
                    }
                }
            }

            const nowVN = dayjs().add(7, "hour").toDate();

            // Tạo document post mới
            const postData = new this.postModel({
                user: createPostDto.userId,
                userModel: createPostDto.userModel,
                content: createPostDto.content,
                media: uploadedMediaUrls,
                keywords: createPostDto.keywords || '',
                isHidden: false,

                embedding: [],
                embeddingModel: '',
                embeddingUpdatedAt: null,

                createdAt: nowVN,
                updatedAt: nowVN
            });

            
            console.log(postData);
            savedPost = await postData.save();

            this.logger.log(`Post created successfully with ID: ${savedPost._id}`);

            // TODO: Uncomment when EmbeddingService is available
            // Tạo embedding async (không block quá trình create)
            // this.generateEmbeddingAsync(savedPost._id.toString(), savedPost.keywords, savedPost.content);

            return savedPost;
        } catch (error) {
            this.logger.error('Error creating post:', error);
            throw new InternalServerErrorException('Lỗi khi tạo bài viết');
        }
    }

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

    private async findOwnerById(ownerId: string): Promise<{  model: 'User' | 'Doctor',data: any; }> {
        try {
            let user = await lastValueFrom(this.usersClient.send('user.getuserbyid',ownerId).pipe(timeout(3000)))
            console.log("user nhan duov la "+ user);
            if (!user) {
                user = await lastValueFrom(
                    this.doctorClient.send('doctor.get-by-id', ownerId)
                    .pipe(timeout(3000)));
                if (!user) {
                    throw new NotFoundException('User not found');
                }
                return { model: 'Doctor', data: user };

            }
            return { model: 'User', data: user };

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
            if (!Types.ObjectId.isValid(ownerId)) {
                // Xử lý lỗi nếu ownerId không hợp lệ (ví dụ: trả về 400 Bad Request)
                // Thay vì InternalServerError, bạn nên dùng một exception phù hợp hơn
                throw new InternalServerErrorException('ID người dùng không hợp lệ'); 
            }

            const { model: ownerModel } = await this.findOwnerById(ownerId);

            const ownerObjectId = new Types.ObjectId(ownerId);

            const filter = {
                user: ownerObjectId,
                userModel: ownerModel,
                $or: [{ isHidden: false }, { isHidden: { $exists: false } }],
            };
            console.log(filter)

            const total = await this.postModel.countDocuments(filter);

            const posts = await this.postModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({
                    path: 'user',
                    model: ownerModel,
                    select: 'name avatarURL',
                })
                .exec();
            
            console.log(posts);

            const hasMore = skip + posts.length < total;
            console.log(posts.length)
            return { posts, hasMore, total };

        } catch (error) {
            this.logger.error('Error getting posts by owner:', error);
            throw new InternalServerErrorException('Lỗi khi lấy bài viết của người dùng');
        }
    }

    async delete(id: string): Promise<{ message: string }> {
        try {
            const updated = await this.postModel.findByIdAndUpdate(
                id,
                { isHidden: true },
                { new: true }
            );
            if (!updated) {
                throw new NotFoundException(`Post with id ${id} not found`);
            }

            return { message: `Post with id ${id} deleted successfully` };
        } catch (error) {
            this.logger.error('Error deleting post:', error);
            throw new InternalServerErrorException('Lỗi khi xóa bài viết');
        }
    }
}
