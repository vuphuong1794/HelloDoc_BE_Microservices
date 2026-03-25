import { Inject, Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
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
import { MediaUrlHelper } from 'libs/media-url.helper';

@Injectable()
export class PostService {
    private readonly logger = new Logger(PostService.name);
    constructor(
        @Inject('USERS_CLIENT') private usersClient: ClientProxy,
        @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
        @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,
        @Inject('EMBEDDING_CLIENT') private embeddingClient: ClientProxy,
        @Inject('QDRANT_CLIENT') private qdrantClient: ClientProxy,
        @InjectModel(Post.name, 'postConnection') private postModel: Model<Post>,
        private cacheService: CacheService,
        private readonly mediaUrlHelper: MediaUrlHelper,
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

                        // Gửi qua Media Client (RPC)
                        const uploadResult = await this.mediaClient
                            .send('media.upload', {
                                buffer: file.buffer, // Base64 string
                                filename: file.originalname,
                                mimetype: file.mimetype,
                                folder: `post/${createPostDto.userId}/media`,
                            })
                            .toPromise();

                        console.log(`Upload success: ${uploadResult.relative_path}`);
                        uploadedMediaUrls.push(uploadResult.relative_path);
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

            // Tạo embedding async (không block quá trình create)
            this.generateEmbeddingAsync(savedPost._id.toString(), savedPost.keywords, savedPost.content);

            return savedPost;
        } catch (error) {
            console.error('Lỗi Media:', error);
        throw new BadRequestException('Lỗi khi tải ảnh bài viết lên Media');
        }
    }

    async getAll(limit: number, skip: number): Promise<{ posts: Post[]; hasMore: boolean; total: number }> {
        try {
            const filter = { $or: [{ isHidden: false }, { isHidden: { $exists: false } }] };

            // Sử dụng .lean() để lấy object nhẹ hơn (Performance)
            const [total, posts] = await Promise.all([
                this.postModel.countDocuments(filter),
                this.postModel.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean()
            ]);

            // Lấy thông tin user cho từng post
            const owners = await Promise.all(
                posts.map(async (post) => {
                    try {
                        const owner = await firstValueFrom(
                            this.usersClient.send('user.getuserbyid', post.user.toString()).pipe(timeout(3000))
                        );

                        return {
                            postUserId: post.user.toString(),   // để mapping chính xác
                            data: this.mediaUrlHelper.constructObjectUrls({
                                _id: owner._id,
                                name: owner.name,
                                avatarURL: owner.avatarURL
                            }, ['avatarURL']) as any
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
            const postsWithOwners = posts.map(post => {
                const userInfo = ownerMap.get(post.user.toString()) || null;
                const postWithMedia = this.mediaUrlHelper.constructObjectUrls(post, ['media']);
                return {
                    ...postWithMedia,
                    userInfo
                };
            });

            const hasMore = skip + posts.length < total;
            console.log("hasMore =", hasMore);
            console.log("skip =", skip);
            console.log("posts.length =", posts.length);
            console.log("skip + posts.length =", skip + posts.length);
            console.log("total =", total);
            // TRẢ VỀ postsWithOwners thay vì posts
            return { posts: postsWithOwners as any, hasMore, total };

        } catch (error) {
            this.logger.error('Error getting paginated posts:', error);
            throw new InternalServerErrorException('Lỗi khi lấy danh sách bài viết');
        }
    }

    async getAllWithFilter(limit: number, skip: number, searchText?: string): Promise<{ data: Post[]; total: number }> {
        try {
            let filter: any = {};

            if (searchText && searchText.trim() !== '') {
                filter = {
                    $or: [
                        { content: { $regex: searchText, $options: 'i' } },
                        { keywords: { $regex: searchText, $options: 'i' } }
                    ]
                };
            }

            const total = await this.postModel.countDocuments(filter);

            const posts = await this.postModel
                .find(filter)
                .lean()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            // Lấy thông tin user cho từng post
            const postWithOwners = await Promise.all(
                posts.map(async (post) => {
                    try {
                        const owner = await firstValueFrom(
                            this.usersClient.send('user.getuserbyid', post.user.toString()).pipe(timeout(3000))
                        );

                        return {
                            ...this.mediaUrlHelper.constructObjectUrls(post, ['media']),
                            userInfo: owner ? {
                                ...this.mediaUrlHelper.constructObjectUrls({
                                    _id: owner._id,
                                    name: owner.name,
                                    avatarURL: owner.avatarURL
                                }, ['avatarURL'])
                            } : null
                        };

                    } catch (error) {
                        console.error(`Error fetching owner ${post.user}:`, error);
                        return {
                            ...post,
                            userInfo: null
                        };
                    }
                })
            );

            return { data: postWithOwners as any, total };

        } catch (error) {
            this.logger.error('Error getting filtered posts:', error);
            throw new InternalServerErrorException('Lỗi khi lấy danh sách bài viết với bộ lọc');
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
            const objectId = new Types.ObjectId(id);
            const post = await this.postModel.findById(objectId)

            if (!post) {
                throw new NotFoundException(`Không tìm thấy bài viết với id ${objectId}`);
            }

            // Lấy thông tin user
            try {
                const owner = await firstValueFrom(
                    this.usersClient.send('user.getuserbyid', post.user.toString()).pipe(timeout(3000))
                );

                const postWithOwner = {
                    ...this.mediaUrlHelper.constructObjectUrls(post.toObject(), ['media']),
                    userInfo: this.mediaUrlHelper.constructObjectUrls({
                        _id: owner._id,
                        name: owner.name,
                        avatarURL: owner.avatarURL
                    }, ['avatarURL'])
                };

                return postWithOwner;

            } catch (error) {
                console.error(`Error fetching owner ${post.user}:`, error);
                // Trả về post mà không có userInfo nếu không thể lấy user
                return {
                    ...post.toObject(),
                    userInfo: null
                };
            }

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
            //console.log("user nhan duov la " + user);
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
                throw new BadRequestException('ID người dùng không hợp lệ');
            }

            const { model: ownerModel } = await this.findOwnerById(ownerId);

            const ownerObjectId = new Types.ObjectId(ownerId);

            const filter = {
                user: ownerObjectId,
                $or: [{ isHidden: false }, { isHidden: { $exists: false } }],
            };

            const total = await this.postModel.countDocuments(filter);

            const posts = await this.postModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec();

            // Lấy thông tin user cho từng post
            const postsWithUserInfo = await Promise.all(
                posts.map(async (post) => {
                    try {
                        const userInfo = await firstValueFrom(
                            this.usersClient.send('user.getuserbyid', post.user.toString()).pipe(
                                timeout(3000),
                            )
                        );

                        return {
                            ...this.mediaUrlHelper.constructObjectUrls(post.toObject(), ['media']),
                            userInfo: userInfo ? {
                                ...this.mediaUrlHelper.constructObjectUrls({
                                    _id: userInfo._id,
                                    name: userInfo.name,
                                    avatarURL: userInfo.avatarURL
                                }, ['avatarURL'])
                            } : null
                        };
                    } catch (error) {
                        console.error(`Error fetching user info for post ${post._id}:`, error);
                        return {
                            ...post.toObject(),
                            userInfo: null
                        };
                    }
                })
            );

            const hasMore = skip + postsWithUserInfo.length < total;

            return { posts: postsWithUserInfo, hasMore, total };

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

                        // Gửi qua Media Client (RPC)
                        const uploadResult = await this.mediaClient
                            .send('media.upload', {
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

    //Hàm tạo embedding async cho post (nhằm tránh block quá trình tạo post chính)
    async generateEmbeddingAsync(postId: string, keywords?: string, content?: string): Promise<void> {
        try {
            await this.generateAndStoreEmbedding(postId, keywords, content);
        } catch (error) {
            this.logger.error(`Failed to generate embedding for post ${postId}: ${error.message}`);
        }
    }

    async generateAndStoreEmbedding(
        postId: string,
        keywords?: string,
        content?: string
    ): Promise<void> {
        try {
            // ============================
            // 1. LẤY DỮ LIỆU TỪ MONGO
            // ============================
            const mongoPost = await this.postModel
                .findById(postId)
                .select("_id content keywords embedding embeddingModel")
                .lean();

            if (!mongoPost) {
                this.logger.warn(`❌ Post ${postId} NOT FOUND in MongoDB.`);
                return;
            }

            // Chuẩn text embedding
            const textForEmbedding =
                keywords?.trim() ||
                mongoPost.keywords?.trim() ||
                content?.trim() ||
                mongoPost.content?.trim();

            if (!textForEmbedding) {
                this.logger.warn(`⚠️ No content or keywords to generate embedding for post ${postId}.`);
                return;
            }

            // ============================
            // 2. KIỂM TRA TỒN TẠI TRONG QDRANT
            // ============================
            const qdrantRecord = await firstValueFrom(
                this.qdrantClient.send('qdrant.get-by-id', { postId })
            ).catch(() => null);

            const hasMongoEmbedding =
                mongoPost.embedding && Array.isArray(mongoPost.embedding) && mongoPost.embedding.length > 0;

            const hasQdrantVector =
                qdrantRecord?.result?.vector &&
                Array.isArray(qdrantRecord.result.vector) &&
                qdrantRecord.result.vector.length > 0;


            // ============================
            // 3. TRƯỜNG HỢP ĐỦ DỮ LIỆU
            // ============================
            if (hasMongoEmbedding && hasQdrantVector) {
                this.logger.log(`✔ Post ${postId} already fully synced. Skipping.`);
                return;
            }

            // ============================
            // 4. CHỈ QDRANT THIẾU VECTOR
            // ============================
            if (hasMongoEmbedding && !hasQdrantVector) {
                this.logger.warn(`⚠️ Qdrant missing vector for post ${postId}. Restoring...`);

                await firstValueFrom(
                    this.qdrantClient.send('qdrant.upsert-post', {
                        postId,
                        vector: mongoPost.embedding,
                        payload: {
                            postId,
                            content: mongoPost.content || "",
                            keywords: mongoPost.keywords || ""
                        }
                    })
                );

                this.logger.log(`🔄 Restored Qdrant vector for post ${postId}.`);
                return;
            }

            // ============================
            // 5. CHỈ MONGO THIẾU EMBEDDING
            // ============================
            if (!hasMongoEmbedding && hasQdrantVector) {
                this.logger.warn(`⚠️ MongoDB missing embedding for post ${postId}. Restoring from Qdrant...`);

                await this.postModel.findByIdAndUpdate(postId, {
                    $set: {
                        embedding: qdrantRecord.result.vector,
                        embeddingModel: "restored-from-qdrant",
                        embeddingUpdatedAt: new Date()
                    }
                });

                this.logger.log(`🔄 Restored MongoDB embedding from Qdrant for post ${postId}.`);
                return;
            }

            // ============================
            // 6. CẢ 2 ĐỀU THIẾU → TẠO MỚI
            // ============================
            this.logger.log(`🚀 Generating new embedding for post ${postId}`);

            const embedding = await this.embeddingClient
                .send("embedding.generate", textForEmbedding)
                .toPromise();

            const modelName = await this.embeddingClient
                .send("embedding.get-model-name", {})
                .toPromise();

            // Lưu vào MongoDB
            await this.postModel.findByIdAndUpdate(
                postId,
                {
                    $set: {
                        embedding,
                        embeddingModel: modelName,
                        embeddingUpdatedAt: new Date()
                    }
                }
            );

            // Lưu vào Qdrant
            await firstValueFrom(
                this.qdrantClient.send('qdrant.upsert-post', {
                    postId,
                    vector: embedding,
                    payload: {
                        postId,
                        content: mongoPost.content || "",
                        keywords: mongoPost.keywords || ""
                    }
                })
            );

            this.logger.log(`✅ Embedding generated & synced for post ${postId}.`);

        } catch (error) {
            this.logger.error(
                `❌ Error generating/storing embedding for post ${postId}: ${error.message}`,
                error.stack || error
            );
        }
    }


    async findSimilarPosts(id: string, limit: number = 10, minSimilarity: number = 0.7) {
        this.logger.log(`Finding posts similar to ID: ${id}`);

        try {
            // await this.updateEmbeddingAsync();
            // 1. Lấy và đảm bảo embedding hợp lệ
            let post = await this.postModel.findById(id).select('embedding').lean();

            if (!post?.embedding || !Array.isArray(post.embedding) || post.embedding.length === 0) {
                this.logger.log(`Post ${id} missing valid embedding. Updating...`);
                await this.updateEmbeddingByPostId(id);
                post = await this.postModel.findById(id).select('embedding').lean();
            }

            const queryVector = post.embedding;

            // 2. Kiểm tra và đảm bảo vector tồn tại trên Qdrant
            const qdrantRecord = await firstValueFrom(
                this.qdrantClient.send('qdrant.get-by-id', { postId: id })
            ).catch(() => null);

            if (!qdrantRecord?.result?.vector) {
                this.logger.log(`Vector not found in Qdrant for post ${id}. Updating...`);
                await this.updateEmbeddingByPostId(id);
            }

            // 3. Tìm kiếm similar posts từ Qdrant
            const similarResults = await firstValueFrom(
                this.qdrantClient.send('qdrant.find-similar-posts', {
                    queryVector,
                    limit,
                    minSimilarity,
                    postId: id,
                })
            );

            if (!similarResults?.length) {
                this.logger.log('No similar posts found from Qdrant');
                return [];
            }

            this.logger.debug(`Qdrant returned ${similarResults.length} similar posts`);

            // 4. Lấy postIds hợp lệ
            const postIds = similarResults
                .map(r => r.postId)
                .filter(Boolean);

            if (!postIds.length) {
                this.logger.warn('No valid postIds from Qdrant results');
                return [];
            }

            // 5. Tải thông tin chi tiết từ MongoDB
            const result = await this.postModel
                .find({ _id: { $in: postIds } })
                .select('_id content media userInfo userModel createdAt keywords')
                .lean();

            this.logger.log(`Loaded ${result.length}/${postIds.length} posts from MongoDB`);

            // 6. Map posts để tra cứu nhanh
            const postMap = new Map(
                result.map(p => [p._id.toString(), p])
            );

            // Chuẩn hóa trả về
            const finalResult = similarResults
                .map(item => {
                    const post = postMap.get(item.postId);
                    if (!post) return null;

                    return {
                        post,
                        similarity: item.score,
                    };
                })
                .filter(Boolean);

            console.log("===== FINAL RESULT =====");
            console.dir(finalResult, { depth: 10 });

            return finalResult;

        } catch (error) {
            this.logger.error(`Error finding similar posts: ${error.message}`, error.stack);
            throw error;
        }
    }

    async updateEmbeddingByPostId(postId: string): Promise<void> {
        //Cập nhật trên qdrant theo postId
        const post = await this.postModel.findById(postId).select('embedding keywords content');
        if (!post) {
            this.logger.warn(`Post ${postId} not found for embedding update`);
            return;
        }
        await this.generateEmbeddingAsync(postId, post.keywords, post.content);
    }


    //Tạo lại toàn bộ embedding cho tất cả post
    async updateEmbeddingAsync(): Promise<void> {
        console.log("⏳ Bắt đầu kiểm tra và cập nhật lại embedding...");

        //Xóa tất cả embedding cũ với kích thước 1024
        await this.postModel.updateMany(
            {},
            { $set: { embedding: [] } }
        );

        // Lấy tất cả post (chỉ lấy embedding, keywords và content)
        const posts = await this.postModel.find({}).select('embedding keywords content');
        console.log(`🔍 Tổng số post: ${posts.length}`);

        let updatedCount = 0;

        for (const post of posts) {
            const id = post._id.toString();
            // Xóa embedding cũ
            await this.postModel.updateOne(
                { _id: id },
                { $set: { embedding: [] } }
            );

            // Tạo lại embedding mới
            await this.generateEmbeddingAsync(id, post.keywords, post.content);

            updatedCount++;

        }
        console.log(`🎉 Đã cập nhật lại embedding cho ${updatedCount} post.`);
    }


}

