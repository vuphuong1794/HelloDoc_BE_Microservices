import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Doctor } from '../core/schema/doctor.schema';
import { CacheService } from 'apps/cache.service';

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(Doctor.name, 'doctorConnection') private DoctorModel: Model<Doctor>,
    private cacheService: CacheService,
  ) { }
  async getDoctorById(id: string) {
    console.log('Received doctor ID:', id, typeof id);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const cacheKey = `doctor_${id}`;
    console.log('Trying to get doctor by id from cache...');

    const cached = await this.cacheService.getCache(cacheKey);
    if (cached) {
      console.log('Cache HIT');
      return cached;
    }

    console.log('Cache MISS - querying DB');
    const doctor = await this.DoctorModel.findById(id).populate('specialty');
    if (!doctor) {
      throw new NotFoundException('Không tìm thấy bác sĩ');
    }

    console.log('Setting cache...');
    await this.cacheService.setCache(cacheKey, doctor, 30 * 1000);
    return doctor;
  }

  async getAllDoctor() {
    return this.DoctorModel.find();
  }

  async updateFcmToken(userId: string, token: string) {
    return this.DoctorModel.findByIdAndUpdate(
      userId,
      { fcmToken: token },
      { new: true }
    );
  }
}
