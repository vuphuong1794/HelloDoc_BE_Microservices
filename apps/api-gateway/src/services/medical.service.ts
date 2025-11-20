import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

@Injectable()
export class MedicalOptionService {
    constructor(
        @Inject('MEDICAL_OPTIONS_CLIENT') private medicalOptionsClient: ClientProxy,
    ) { }

    async getMedicalOptions() {
        // Logic to get medical options
        return this.medicalOptionsClient.send('medicalservice.get-medical-options', {});
    }

}
