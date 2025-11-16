import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PostController } from '../controller/post.controller';
import { PostService } from '../services/post.service';

@Module({
    imports: [
        //ket noi gateway voi post service (ket noi dung giao thuc va port)
        ClientsModule.register([
            {
                name: 'POST_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3012,
                },
            },
        ]),
    ],
    controllers: [PostController],
    providers: [PostService],
})
export class PostModule { }

