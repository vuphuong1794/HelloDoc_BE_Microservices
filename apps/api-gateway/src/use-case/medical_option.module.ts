import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MedicalOptionController } from "../controller/medical_option.controller";
import { MedicalOptionService } from "../services/medical.service";

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'MEDICAL_OPTIONS_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3011,
                },
            },
        ]),
    ],
    controllers: [MedicalOptionController],
    providers: [MedicalOptionService],
})
export class MedicalOptionModule { }