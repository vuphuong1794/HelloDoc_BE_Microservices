import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CloudinaryService } from './service/cloudinary.service';

@Module({
  imports: [
    //ket noi gateway voi users service (ket noi dung giao thuc va port)
    ClientsModule.register([
      {
        name: 'CLOUDINARY_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3006,
        },
      },
    ]),
  ],
  controllers: [],
  providers: [CloudinaryService],
})
export class CloudinaryModule { }
