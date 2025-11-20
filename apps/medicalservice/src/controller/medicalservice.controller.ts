import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateMedicalOptionDto } from '../core/dto/create-medical-option.dto';
import { UpdateMedicalOptionDto } from '../core/dto/update-medical-option.dto';
import { MedicalserviceService } from '../service/medicalservice.service';

@Controller()
export class MedicalserviceController {
  constructor(
    private readonly medicalserviceService: MedicalserviceService
  ) { }

  @MessagePattern('medicalservice.get-medical-options')
  async getMedicalOptions() {
    return this.medicalserviceService.getMedicalOptions();
  }

  @MessagePattern('medicalservice.create-medical-option')
  create(@Body() createMedicalOptionDto: CreateMedicalOptionDto) {
    return this.medicalserviceService.create(createMedicalOptionDto);
  }

  @MessagePattern('medicalservice.get-medical-option-by-id')
  findOne(@Param('id') id: string) {
    return this.medicalserviceService.findOne(+id);
  }

  @MessagePattern('medicalservice.update-medical-option')
  update(@Param('id') id: string, @Body() updateMedicalOptionDto: UpdateMedicalOptionDto) {
    return this.medicalserviceService.update(+id, updateMedicalOptionDto);
  }

  @MessagePattern('medicalservice.delete-medical-option')
  remove(@Param('id') id: string) {
    return this.medicalserviceService.remove(+id);
  }
}
