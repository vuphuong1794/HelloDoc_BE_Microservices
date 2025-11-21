import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
    imports: [
        //ket noi gateway voi users service (ket noi dung giao thuc va port)
        ClientsModule.register([
            {
                name: 'QDRANT_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3013,
                },
            },
        ]),
    ],
    controllers: [],
    providers: [],
})
export class QdrantModule { }
