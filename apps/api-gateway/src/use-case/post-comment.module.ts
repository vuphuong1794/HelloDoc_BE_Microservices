import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PostCommentController } from '../controller/post-comment.controller';
import { PostCommentService } from '../services/post-comment.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'POST_COMMENT_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3019,
                },
            },
        ]),
    ],
    controllers: [PostCommentController],
    providers: [PostCommentService],
})
export class PostCommentModule {}
