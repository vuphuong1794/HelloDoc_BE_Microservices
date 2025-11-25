import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreatePostFavoriteDto } from '../core/dto/post-favorite/create-post-favorite.dto';
import { GetPostFavoriteDto } from '../core/dto/post-favorite/get-post-favorite.dto';

@Injectable()
export class PostFavoriteService {
    constructor(
        @Inject('POST_FAVORITE_CLIENT') private readonly postFavoriteClient: ClientProxy,
    ) { }

    async getPostFavoritesByPostId(postId: string, getPostFavoriteDto: GetPostFavoriteDto) {
        return this.postFavoriteClient.send('post-favorite.get-by-post', { postId, getPostFavoriteDto });
    }

    async updatePostFavoriteByPostId(postId: string, createPostFavoriteDto: CreatePostFavoriteDto) {
        return this.postFavoriteClient.send('post-favorite.update', { postId, createPostFavoriteDto });
    }

    async getPostFavoritesByUserId(userId: string) {
        return this.postFavoriteClient.send('post-favorite.get-by-user', { userId });
    }
}
