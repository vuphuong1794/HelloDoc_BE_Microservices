import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { CreateNewsDto } from "apps/news/src/core/dto/createNews.dto";
import { UpdateNewsDto } from "apps/news/src/core/dto/updateNews.dto";

@Injectable()
export class NewsService {
    constructor(@Inject('NEWS_CLIENT') private newsClient: ClientProxy) { }
    async getAll() {
        return this.newsClient.send('news.get-all', {})
    }

    async getById(id: string) {
        return this.newsClient.send('news.get-by-id', id)
    }

    async delete(id: string) {
        return this.newsClient.send('news.delete', id)
    }

    async update(id: string, updateDto: UpdateNewsDto) {
        return this.newsClient.send('news.update', { id, ...updateDto })
    }

    async create(createNewsDto: CreateNewsDto) {
        return this.newsClient.send('news.create', createNewsDto)
    }
}