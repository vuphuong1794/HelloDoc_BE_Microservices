import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Doctor } from '../core/schema/doctor.schema';
import { CacheService } from 'libs/cache.service';
import * as bcrypt from 'bcrypt';
import * as admin from 'firebase-admin';
import { ClientProxy } from '@nestjs/microservices';
import { PendingDoctor } from '../core/schema/PendingDoctor.schema';

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(Doctor.name, 'doctorConnection') private DoctorModel: Model<Doctor>,
    @InjectModel(PendingDoctor.name, 'doctorConnection') private pendingDoctorModel: Model<PendingDoctor>,
    @Inject('USERS_CLIENT') private usersClient: ClientProxy,
    @Inject('SPECIALTY_CLIENT') private specialtyClient: ClientProxy,
    private cacheService: CacheService,
  ) { }
  async getDoctorById(id: string) {
    console.log('Received doctor ID:', id, typeof id);
    const objectId = new Types.ObjectId(id);

    if (!Types.ObjectId.isValid(objectId)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    // const cacheKey = `doctor_${id}`;
    // console.log('Trying to get doctor by id from cache...');

    // const cached = await this.cacheService.getCache(cacheKey);
    // if (cached) {
    //   console.log('Cache HIT');
    //   return cached;
    // }

    console.log('Cache MISS - querying DB');
    const doctor = await this.DoctorModel.findById(objectId).populate('specialty');
    if (!doctor) {
      throw new NotFoundException('Không tìm thấy bác sĩ');
    }

    console.log('Setting cache...');
    // await this.cacheService.setCache(cacheKey, doctor, 30 * 1000);
    return doctor;
  }

  async getAllDoctor() {
    const doctors = await this.DoctorModel.find();

    const specialtyIds = [...new Set(
      doctors
        .map(doc => doc.specialty?.toString())
        .filter(Boolean)
    )];

    if (specialtyIds.length === 0) {
      return doctors;
    }

    // Gửi đúng format
    const specialties = await this.specialtyClient
      .send('specialty.get-by-ids', { specialtyIds })
      .toPromise();

    return doctors.map(doc => {
      const doctorObj = doc.toObject();
      const specialtyId = doc.specialty?.toString();
      const specialtyData = specialties.find(
        s => s._id.toString() === specialtyId
      );

      return {
        ...doctorObj,
        specialty: specialtyData || doctorObj.specialty
      };
    });
  }

  async getDoctorBySpecialtyID(specialtyId: string) {
    return this.DoctorModel.find({ specialty: specialtyId });
  }

  async updateFcmToken(userId: string, token: string) {
    return this.DoctorModel.findByIdAndUpdate(
      userId,
      { fcmToken: token },
      { new: true }
    );
  }

  async updatePassword(email: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await this.DoctorModel.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );
    if (!updated) throw new NotFoundException('Không tìm thấy bác sĩ');
    return updated;
  }

  async notify(doctorId: string, message: string) {
    try {
      const doctor = await this.DoctorModel.findById(doctorId);
      if (doctor?.fcmToken) {
        await admin.messaging().send({
          token: doctor.fcmToken,
          notification: {
            title: 'Thông báo lịch hẹn mới',
            body: message,
          },
        });
        console.log(`Đã gửi thông báo đến bác sĩ ${doctorId}`);
      } else {
        console.warn(`Bác sĩ ${doctorId} không có fcmToken`);
      }
    } catch (error) {
      console.error(`Lỗi khi gửi thông báo đến bác sĩ ${doctorId}:`, error);
    }
  }

  async getPendingDoctors() {
    return this.pendingDoctorModel.find();
  }

  async getPendingDoctorById(id: string) {
    return this.pendingDoctorModel.findById(id);
  }

  async createPendingDoctor(data: any) {
    return this.pendingDoctorModel.create(data);
  }

  async applyForDoctor(userId: string, applyData: any) {
    return this.usersClient.send('user.apply-for-doctor', { userId, applyData });
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    const doctor = await this.DoctorModel.findById(id);
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    if (doctor.isDeleted) {
      return { message: 'Doctor already deleted' };
    }
    await this.DoctorModel.findByIdAndDelete(id, { isDeleted: true });
    return { message: 'Doctor deleted successfully' };
  }

  async create(createDoctorDto: any) {
    return this.DoctorModel.create(createDoctorDto);
  }

  async updateDoctor(id: string, updateDoctorDto: any) {
    return this.DoctorModel.findByIdAndUpdate(id, updateDoctorDto);
  }
}
