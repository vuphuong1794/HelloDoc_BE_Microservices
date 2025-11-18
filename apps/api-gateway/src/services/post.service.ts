import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class PostService {
    constructor(@Inject('POST_CLIENT') private postClient: ClientProxy) { }

    getAll() {
        return this.postClient.send('post.get-all', {});
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
}
