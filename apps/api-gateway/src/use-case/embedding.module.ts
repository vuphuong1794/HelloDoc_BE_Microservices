import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
    imports: [
        //ket noi gateway voi users service (ket noi dung giao thuc va port)
        ClientsModule.register([
            {
                name: 'EMBEDDING_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3012,
                },
            },
        ]),
    ],
    controllers: [],
    providers: [],
})
export class EmbeddingModule { }
