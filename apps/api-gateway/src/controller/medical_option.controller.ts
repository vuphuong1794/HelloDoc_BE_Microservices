import { Body, Controller, Get, Post } from "@nestjs/common";
import { MedicalOptionService } from "../services/medical.service";
import { CreateMedicalOptionDto } from "../core/dto/create-medical-option.dto";

@Controller('medical-option')
export class MedicalOptionController {
    constructor(
        private readonly medicalOptionService: MedicalOptionService,
    ) { }

    @Get('get-all')
    getMedicalOptions() {
        return this.medicalOptionService.getMedicalOptions();
    }

    @Post('create')
    createMedicalOption( @Body() createMedicalOptionDto: CreateMedicalOptionDto) {
        return this.medicalOptionService.createMedicalOption(createMedicalOptionDto);
    }


}
