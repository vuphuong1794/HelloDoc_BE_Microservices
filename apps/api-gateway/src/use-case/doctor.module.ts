import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DoctorController } from '../controller/doctor.controller';
import { DoctorService } from '../services/doctor.service';

@Module({
    imports: [
        //ket noi gateway voi users service (ket noi dung giao thuc va port)
        ClientsModule.register([
            {
                name: 'DOCTOR_CLIENT',
                 transport: Transport.RMQ,
                options: {
                    urls: ['amqp://guest:guest@localhost:5672'],
                    queue: 'doctor_queue',
                    queueOptions: {
                    durable: true //keep messages in the queue if the consumer is not connected
                    },
                },
            },
            {
                name: 'CLOUDINARY_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',
                    port: 3006
                }
            }
        ]),
    ],
    controllers: [DoctorController],
    providers: [DoctorService],
})
export class DoctorModule { }
