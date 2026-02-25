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
                    urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
                    queue: 'doctor_queue',
                    queueOptions: {
                        durable: true
                    },
                },
            },
            {
                name: 'MEDIA_CLIENT',
                transport: Transport.RMQ,
                options: {
                    urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
                    queue: 'media_queue',
                    queueOptions: {
                        durable: true
                    },
                }
            }
        ]),
    ],
    controllers: [DoctorController],
    providers: [DoctorService],
})
export class DoctorModule { }
