import { Injectable } from '@nestjs/common';
import { CloudinaryResponse } from 'apps/cloudinary/src/cloudinary-response';
import { v2 as cloudinary } from 'cloudinary';

const streamifier = require('streamifier');
import { Express } from 'express';

@Injectable()
export class CloudinaryService {
    uploadFile(file: Express.Multer.File, folder: string = ''): Promise<CloudinaryResponse> {
        return new Promise<CloudinaryResponse>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    resource_type: 'auto',
                },
                (error, result) => {
                    if (error) return reject(error);
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error('Upload result is undefined'));
                    }
                },
            );

            streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
    }
}
