import { Controller, Get } from '@nestjs/common';
import { SpecialtyService } from '../service/specialty.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Specialty } from '../core/schema/specialty.schema';
import { Model } from 'mongoose';

@Controller()
export class SpecialtyController {
  constructor(
    private readonly specialtyService: SpecialtyService,
    @InjectModel(Specialty.name, 'specialtyConnection') private SpecialtyModel: Model<Specialty>,

  ) { }

  @MessagePattern('specialty.get-all')
  getSpecialties() {
    return this.specialtyService.getSpecialties();
  }

  @MessagePattern('specialty.create')
  create(createSpecialtyDto: any) {
    return this.specialtyService.create(createSpecialtyDto);
  }

  @MessagePattern('specialty.update')
  update(@Payload() data: any) {
    const { id, updateSpecialty } = data;
    return this.specialtyService.update(id, updateSpecialty);
  }

  @MessagePattern('specialty.remove')
  remove(id: string) {
    return this.specialtyService.remove(id);
  }

  @MessagePattern('specialty.get-by-id')
  getSpecialtyById(id: string) {
    return this.specialtyService.getSpecialtyById(id);
  }

  @MessagePattern('specialty.get-by-ids') // Đổi từ get-by-id thành get-by-ids
  async getSpecialtiesByIds(@Payload() data: { specialtyIds: string[] }) {
    return this.specialtyService.findByIds(data.specialtyIds);
  }

  @MessagePattern('specialty.delete-doctor-specialties')
  async deleteDoctorSpecialties(@Payload() data: { doctorId: string; specialtyIds: string[] }) {
    const { doctorId, specialtyIds } = data;
    return await this.SpecialtyModel.updateMany(
      { _id: { $in: specialtyIds } },
      { $pull: { doctors: doctorId } }
    );
  }

  @MessagePattern('specialty.update-doctor-specialties')
  async updateDoctorSpecialties(@Payload() data: { doctorId: string; specialtyIds: string }) {
    const { doctorId, specialtyIds } = data;
    return await this.SpecialtyModel.findByIdAndUpdate(
      specialtyIds,
      { $addToSet: { doctors: doctorId } }, // Sử dụng $addToSet để tránh trùng lặp
      { new: true }
    );
  }
}