import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreatePostDto } from 'apps/post/src/core/dto/createPost.dto';
import { UpdatePostDto, UpdateKeywordsDto } from 'apps/post/src/core/dto/updatePost.dto';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class PostService {
    constructor(@Inject('POST_CLIENT') private postClient: ClientProxy) { }

    async create(createPostDto: CreatePostDto, files?: Express.Multer.File[]) {
        return lastValueFrom(this.postClient.send('post.create', { createPostDto, files }));
    }

    async getAll(limit: number = 10, skip: number = 0) {
        return lastValueFrom(this.postClient.send('post.get-all', { limit: limit.toString(), skip: skip.toString() }));
    }

    async search(q: string) {
        return lastValueFrom(this.postClient.send('post.search', { q }));
    }

    async getOne(id: string) {
        return lastValueFrom(this.postClient.send('post.get-one', { id }));
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

    async findSimilarPosts(id: string, limit: number = 10, minSimilarity: number = 0.7) {
        return lastValueFrom(this.postClient.send('post.find-similar', { id, limit, minSimilarity }));
    }

    async hybridSearch(q: string, limit: number = 5, minSimilarity: number = 0.75) {
        return lastValueFrom(this.postClient.send('post.hybrid-search', { q, limit, minSimilarity }));
    }

    async searchPosts(query: string) {
        return lastValueFrom(this.postClient.send('post.search-advanced', { query }));
    }

    async hasKeywords(id: string) {
        return lastValueFrom(this.postClient.send('post.has-keywords', { id }));
    }

    async hasEmbedding(id: string) {
        return lastValueFrom(this.postClient.send('post.has-embedding', { id }));
    }

    async generateAndStoreEmbedding(id: string, keywords?: string, content?: string) {
        return lastValueFrom(this.postClient.send('post.generate-embedding', { id, keywords, content }));
    }

    async updatePostKeywords(id: string, keywords: string) {
        return lastValueFrom(this.postClient.send('post.update-keywords', { id, keywords }));
    }

    async generateEmbeddingAsync(id: string, keywords?: string, content?: string) {
        return lastValueFrom(this.postClient.send('post.generate-embedding-async', { id, keywords, content }));
    }
}
