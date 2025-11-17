import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PostController } from '../controller/post.controller';
import { PostService } from '../services/post.service';


@Module({
    imports: [

        ClientsModule.register([
            {
                name: 'POST_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3002,
                },
            },
        ]),
    ],
    controllers: [PostController],
    providers: [PostService],
})
export class PostModule { }
