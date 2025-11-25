import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NewsFavoriteController } from '../controller/news-favorite.controller';
import { NewsFavoriteService } from '../services/news-favorite.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NEWS_FAVORITE_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3015,
        },
      },
    ]),
  ],
  controllers: [NewsFavoriteController],
  providers: [NewsFavoriteService],
  exports: [NewsFavoriteService],
})
export class NewsFavoriteModule {}
