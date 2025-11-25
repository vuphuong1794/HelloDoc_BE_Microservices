import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreatePostDto } from '../core/dto/post/createPost.dto';
import { UpdatePostDto, UpdateKeywordsDto } from '../core/dto/post/updatePost.dto';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class PostService {
    constructor(@Inject('POST_CLIENT') private postClient: ClientProxy) { }

    async create(createPostDto: CreatePostDto, files?: Express.Multer.File[]) {
        return lastValueFrom(this.postClient.send('post.create', { createPostDto, files }));
    }

    getAll() {
        return this.postClient.send('post.get-all', {});
    }

    async search(q: string) {
        return lastValueFrom(this.postClient.send('post.search', { q }));
    }

    async getOne(id: string) {
        return lastValueFrom(this.postClient.send('post.get-by-post-id', { id }));
    }

    async getByUserId(id: string, limit: number = 10, skip: number = 0) {
        return lastValueFrom(this.postClient.send('post.get-by-user-id', { id, limit: limit.toString(), skip: skip.toString() }));
    }

    async update(id: string, updatePostDto: UpdatePostDto, images?: Express.Multer.File[]) {
        return lastValueFrom(this.postClient.send('post.update', { id, updatePostDto, images }));
    }

    async delete(id: string) {
        return lastValueFrom(this.postClient.send('post.delete', { id }));
    }

    async searchPosts(query: string) {
        return lastValueFrom(this.postClient.send('post.search-advanced', { query }));
    }
}
