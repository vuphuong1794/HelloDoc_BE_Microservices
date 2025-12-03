import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NlpController } from '../controller/nlp-integration.controller';
import { NlpIntegrationService } from '../services/nlp-integration.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'NLP_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',
                    port: 3022,
                },
            },
        ]),
    ],
    controllers: [NlpController],
    providers: [NlpIntegrationService],
})
export class NlpIntegrationModule { }

