import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UndertheseaController } from '../controller/underthesea.controller';
import { UndertheseaService } from '../services/underthesea.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'UNDERTHESEA_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3020,
                },
            },
        ]),
    ],
    controllers: [UndertheseaController],
    providers: [UndertheseaService],
})
export class UndertheseaModule { }
