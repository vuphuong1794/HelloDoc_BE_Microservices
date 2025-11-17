import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Express } from 'express';
import { Model } from 'mongoose';
import { In } from 'typeorm';
import { Post } from '../core/schema/post.schema';

@Injectable()
export class PostService {
    private readonly logger = new Logger(PostService.name);
    constructor(
        @InjectModel(Post.name, 'postConnection') private postModel: Model<Post>,
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
}
