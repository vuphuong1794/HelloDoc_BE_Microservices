import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

@Injectable()
export class CloudinaryService {
    constructor(
        @Inject('CLOUDINARY_CLIENT') private cloudinaryClient: ClientProxy,

    ) { }

    async uploadFile(file: Express.Multer.File) {
        return this.cloudinaryClient.send('cloudinary.upload', file)
    }

}