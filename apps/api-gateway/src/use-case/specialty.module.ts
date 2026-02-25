import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SpecialtyController } from '../controller/specialty.controller';
import { SpecialtyService } from '../services/specialty.service';

@Module({
    imports: [
        //ket noi gateway voi users service (ket noi dung giao thuc va port)
        ClientsModule.register([
            {
                name: 'SPECIALTY_CLIENT',
                transport: Transport.RMQ,
                options: {
                    urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
                    queue: 'specialty_queue',
                    queueOptions: {
                        durable: true //keep messages in the queue if the consumer is not connected
                    },
                },
            },
        ]),
    ],
    controllers: [SpecialtyController],
    providers: [SpecialtyService],
})
export class SpecialtyModule { }
