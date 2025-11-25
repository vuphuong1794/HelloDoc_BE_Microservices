import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PostFavoriteController } from '../controller/post-favorite.controller';
import { PostFavoriteService } from '../services/post-favorite.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'POST_FAVORITE_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3014,
                },
            },
        ]),
    ],
    controllers: [PostFavoriteController],
    providers: [PostFavoriteService],
})
export class PostFavoriteModule { }
