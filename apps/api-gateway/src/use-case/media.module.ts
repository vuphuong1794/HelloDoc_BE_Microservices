import { Injectable, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { MediaController } from "../controller/media.controller";
import { MediaService } from "../services/media.service";

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'MEDIA_CLIENT',
                transport: Transport.RMQ,
                options: {
                    urls: ['amqp://guest:guest@localhost:5672'],
                    queue: 'media_queue',
                    queueOptions: {
                        durable: true
                    },
                },
            }
        ])
    ],
    controllers: [MediaController],
    providers: [MediaService],
})

export class MediaModule { }