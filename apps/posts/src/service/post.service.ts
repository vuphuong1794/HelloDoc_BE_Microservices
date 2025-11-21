import { Inject, Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Express } from 'express';
import { Model } from 'mongoose';
import { CreatePostDto } from '../core/dto/createPost.dto';
import { UpdatePostDto, UpdateKeywordsDto } from '../core/dto/updatePost.dto';
import { CacheService } from 'libs/cache.service';
import { Post } from '../core/schema/post.schema';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import * as dayjs from 'dayjs';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PostService {
    private readonly logger = new Logger(PostService.name);
    constructor(
        @Inject('USERS_CLIENT') private usersClient: ClientProxy,
        @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
        @Inject('CLOUDINARY_CLIENT') private cloudinaryClient: ClientProxy,
        @Inject('EMBEDDING_CLIENT') private embeddingClient: ClientProxy,
        @Inject('QDRANT_CLIENT') private qdrantClient: ClientProxy,
        @InjectModel(Post.name, 'postConnection') private postModel: Model<Post>,
        private cacheService: CacheService,
    ) { }

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
            const filter = { $or: [{ isHidden: false }, { isHidden: { $exists: false } }] };

            const total = await this.postModel.countDocuments(filter);

            const posts = await this.postModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            // Lấy thông tin user cho từng post
            const owners = await Promise.all(
                posts.map(async (post) => {
                    try {
                        const owner = await firstValueFrom(
                            this.usersClient.send('user.getuserbyid', post.user.toString()).pipe(timeout(3000))
                        );

                        return {
                            postUserId: post.user.toString(),   // để mapping chính xác
                            data: {
                                _id: owner._id,
                                name: owner.name,
                                avatarURL: owner.avatarURL
                            }
                        };

                    } catch (error) {
                        console.error(`Error fetching owner ${post.user}:`, error);
                        return null;
                    }
                })
            );

            // map thành dictionary để lookup nhanh
            const ownerMap = new Map(
                owners
                    .filter(o => o !== null)
                    .map(o => [o.postUserId, o.data])
            );

            // gán lại dữ liệu user
            const postsWithOwners = posts.map(post => ({
                ...post.toObject(),
                userInfo: ownerMap.get(post.user.toString()) || null // thêm field mới
            }));

            const hasMore = skip + posts.length < total;

            // TRẢ VỀ postsWithOwners thay vì posts
            return { posts: postsWithOwners, hasMore, total };

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

    private async findOwnerById(ownerId: string): Promise<{ model: 'User' | 'Doctor', data: any; }> {
        try {
            let user = await lastValueFrom(this.usersClient.send('user.getuserbyid', ownerId).pipe(timeout(3000)))
            console.log("user nhan duov la " + user);
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

    async update(id: string, updatePostDto: UpdatePostDto) {
        let updatedPost: Post;

        try {
            this.logger.log(`Updating post ${id} with data:`, JSON.stringify(updatePostDto, null, 2));

            const existingPost = await this.postModel.findById(id);
            if (!existingPost) {
                throw new NotFoundException('Post not found');
            }

            const mediaUrls = updatePostDto.media ?? existingPost.media ?? [];
            const images = (updatePostDto.images ?? []) as Express.Multer.File[];

            // Upload ảnh mới nếu có
            if (images.length > 0) {
                const newMediaUrls: string[] = [];
                for (const file of images) {
                    try {
                        console.log(`Uploading image: ${file.originalname}`);

                        // Gửi qua Cloudinary Client (RPC)
                        const uploadResult = await this.cloudinaryClient
                            .send('cloudinary.upload', {
                                buffer: file.buffer, // Base64 string
                                filename: file.originalname,
                                mimetype: file.mimetype,
                                folder: `Post/${updatePostDto.userId}/Image`,
                            })
                            .toPromise();

                        console.log(`Upload success: ${uploadResult.secure_url}`);
                        newMediaUrls.push(uploadResult.secure_url);
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
                existingPost.media = [...mediaUrls, ...newMediaUrls];
            } else if (updatePostDto.media) {
                existingPost.media = updatePostDto.media;
            }

            // Cập nhật content & keywords
            if (updatePostDto.content !== undefined) {
                existingPost.content = updatePostDto.content;
            }

            if (updatePostDto.keywords !== undefined) {
                existingPost.keywords = updatePostDto.keywords;
            }

            updatedPost = await existingPost.save();

            this.logger.log(`Post updated successfully:`, JSON.stringify((updatedPost as any).toObject(), null, 2));

            // TODO: Uncomment when EmbeddingService is available
            // Nếu có thay đổi content/keywords -> cập nhật embedding
            // if (updatePostDto.content !== undefined || updatePostDto.keywords !== undefined) {
            //     this.updateEmbeddingAsync(updatedPost._id.toString(), updatedPost.content, updatedPost.keywords);
            // }

            return updatedPost;

        } catch (error) {
            this.logger.error(`Error updating post ${id}:`, error);
            throw new InternalServerErrorException('Lỗi khi cập nhật bài viết');
        }
    }

    async searchPosts(query: string) {
        // const queryVector = await this.embeddingClient.generateEmbedding(query);
        const queryVector = await firstValueFrom(this.embeddingClient.send('embedding.generate', query));

        console.log('Before qdrant')
        // const results = await this.qdrantService.findSimilarPostsQdrant(queryVector, 10, 0.5);
        const results = await firstValueFrom(
            this.qdrantClient.send('qdrant.find-similar-posts', {
                queryVector,
                limit: 10,
                minSimilarity: 0.5,
            }));
        // Lấy detail từ Mongo bằng id
        const ids = results.map(r => r.postId);
        const posts = await this.postModel.find({ _id: { $in: ids } }, { embedding: 0 }).populate('user', 'name avatarURL');

        // Trả về post trực tiếp với similarity score được thêm vào
        return results.map(r => {
            const post = posts.find(p => p._id.toString() === r.postId);
            return {
                ...post?.toObject(), // Spread post data directly
                similarity: r.similarity
            };
        }).filter(item => item._id); // Filter out any null posts
    }
}
