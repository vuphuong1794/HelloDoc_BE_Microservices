import { Injectable, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { CloudinaryService } from "../services/cloudinary.service";

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'CLOUDINARY_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',
                    port: 3006
                }
            }
        ])
    ],
    controllers: [],
    providers: [CloudinaryService],
})

export class CloudinaryModule { }