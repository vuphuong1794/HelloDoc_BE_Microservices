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
                    urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
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