import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { CreateMedicalOptionDto } from "../core/dto/create-medical-option.dto";

@Injectable()
export class MedicalOptionService {
    constructor(
        @Inject('MEDICAL_OPTIONS_CLIENT') private medicalOptionsClient: ClientProxy,
    ) { }

    async getMedicalOptions() {
        // Logic to get medical options
        return this.medicalOptionsClient.send('medicalservice.get-medical-options', {});
    }

    async createMedicalOption(createMedicalOptionDto: CreateMedicalOptionDto) {
        // Logic to create a medical option
        return this.medicalOptionsClient.send('medicalservice.create-medical-option', createMedicalOptionDto);
    }

}
