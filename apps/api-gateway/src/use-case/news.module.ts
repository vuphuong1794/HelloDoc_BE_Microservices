import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NewsController } from '../controller/news.controller';
import { NewsService } from '../services/news.service';

@Module({
    imports: [
        //ket noi gateway voi news service (ket noi dung giao thuc va port)
        ClientsModule.register([
            {
                name: 'NEWS_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3004,
                },
            },
        ]),
    ],
    controllers: [NewsController],
    providers: [NewsService],
})
export class NewsModule { }
