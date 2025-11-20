import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicalOption } from '../core/scheme/medical-option.scheme';
import { ClientProxy } from '@nestjs/microservices';
import { CreateMedicalOptionDto } from 'apps/api-gateway/src/core/dto/create-medical-option.dto';

@Injectable()
export class MedicalserviceService {
  constructor(
    @InjectModel(MedicalOption.name, 'medicalServiceConnection') private MedicalOptionModel: Model<MedicalOption>
  ) { }
  async getMedicalOptions() {
    try {
      console.log('Fetching medical options from medical service...' +await this.MedicalOptionModel.find().countDocuments());
      return await this.MedicalOptionModel.find();
    } catch (error) {
      throw new Error('Đã xảy ra lỗi khi lấy danh sách dịch vụ khám');
    }
  }

  async create(createMedicalOptionDto: CreateMedicalOptionDto) {
    const createdMedicalOption = new this.MedicalOptionModel(createMedicalOptionDto);
    return createdMedicalOption.save();
  }

  async findOne(id: number) {
    return this.MedicalOptionModel.findById(id);
  }

  async update(id: number, updateMedicalOptionDto: any) {
    return this.MedicalOptionModel.findByIdAndUpdate(id, updateMedicalOptionDto, { new: true });
  }

  async remove(id: number) {
    return this.MedicalOptionModel.findByIdAndDelete(id);
  }
  
}
