import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NewsCommentController } from '../controller/news-comment.controller';
import { NewsCommentService } from '../services/news-comment.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NEWS_COMMENT_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3016,
        },
      },
    ]),
  ],
  controllers: [NewsCommentController],
  providers: [NewsCommentService],
  exports: [NewsCommentService],
})
export class NewsCommentModule {}
