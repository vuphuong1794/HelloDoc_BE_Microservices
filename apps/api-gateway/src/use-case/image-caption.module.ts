import { Injectable, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ImageCaptioningController } from "../controller/image-caption.controller";
import { ImageCaptionService } from "../services/image-caption.service";
import { HttpService } from "@nestjs/axios";

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'IMAGE_CAPTION_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',
                    port: 3023
                }
            }
        ])
    ],
    controllers: [ImageCaptioningController],
    providers: [ImageCaptionService],
})

export class ImageCaptionModule { }