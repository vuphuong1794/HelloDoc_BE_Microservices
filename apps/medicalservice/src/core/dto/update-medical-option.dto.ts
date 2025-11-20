import { PartialType } from '@nestjs/mapped-types';
import { CreateMedicalOptionDto } from './create-medical-option.dto';

export class UpdateMedicalOptionDto extends PartialType(CreateMedicalOptionDto) {}
