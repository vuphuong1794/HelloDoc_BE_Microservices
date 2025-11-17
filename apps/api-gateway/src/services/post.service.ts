import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PostService {
    constructor(@Inject('POST_CLIENT') private postClient: ClientProxy) { }

    getAll() {
        return this.postClient.send('post.get-all', {});
    }
}
