import { Controller, Get } from "@nestjs/common";
import { MedicalOptionService } from "../services/medical.service";

@Controller('medical-option')
export class MedicalOptionController {
    constructor(
        private readonly medicalOptionService: MedicalOptionService,
    ) { }

    @Get('get-all')
    getMedicalOptions() {
        return this.medicalOptionService.getMedicalOptions();
    }


}
