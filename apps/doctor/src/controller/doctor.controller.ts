
import { Body, Controller, Get, Param, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { DoctorService } from '../service/doctor.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Doctor } from '../core/schema/doctor.schema';
import { Model } from 'mongoose';

@Controller()
export class DoctorController {
  constructor(
    @InjectModel(Doctor.name, 'doctorConnection') private DoctorModel: Model<Doctor>,

    private readonly doctorService: DoctorService
  ) { }

  @MessagePattern('doctor.get-by-id')
  async getDoctorById(id: string) {
    return this.doctorService.getDoctorById(id);
  }

  @MessagePattern('doctor.get-all')
  async getAllDoctor() {
    return this.doctorService.getAllDoctor();
  }

  @MessagePattern('doctor.get-all-filtered')
  async getAllWithFilter(@Payload() data: { limit?: number; offset?: number; searchText?: string }) {
    const limit = data.limit ?? 10;
    const skip = data.offset ?? 0;
    const searchText = data.searchText;

    return this.doctorService.getAllWithFilter(limit, skip, searchText);
  }

  @MessagePattern('doctor.get-by-specialtyID')
  async getDoctorBySpecialtyID(specialtyID: string) {
    return this.doctorService.getDoctorBySpecialtyID(specialtyID);
  }

  @MessagePattern('doctor.update-fcm-token')
  async updateFcmToken(@Payload() data: any) {
    const { id, token } = data;
    return this.doctorService.updateFcmToken(id, token);
  }

  @MessagePattern('doctor.updatePassword')
  async updatePassword(@Payload() data: { email: string, password: string }) {
    return this.doctorService.updatePassword(data.email, data.password);
  }

  @MessagePattern('doctor.notify')
  async notify(@Payload() data: { doctorID: string, message: string }) {
    console.log('📨 Nhận message doctor.notify:', data);

    return this.doctorService.notify(data.doctorID, data.message);
  }

  @MessagePattern('doctor.get-pedingDoctor')
  async getPendingDoctor() {
    return this.doctorService.getPendingDoctors();
  }

  @MessagePattern('doctor.get-pedingDoctor-by-id')
  async getPendingDoctorById(id: string) {
    return this.doctorService.getPendingDoctorById(id);
  }

  @MessagePattern('doctor.get-rejected-doctor')
  async getRejectedDoctors() {
    return this.doctorService.getRejectedDoctors();
  }

  @MessagePattern('doctor.create-pending-doctor')
  async createPendingDoctor(@Payload() data: any) {
    return this.doctorService.createPendingDoctor(data);
  }

  @MessagePattern('doctor.apply-for-doctor')
  async applyForDoctor(@Payload() payload: { userId: string, applyData: any }) {
    return this.doctorService.applyForDoctor(payload.userId, payload.applyData);
  }

  @MessagePattern('doctor.delete')
  async delete(id: string) {
    return this.doctorService.delete(id);
  }

  @MessagePattern('doctor.create')
  async create(@Payload() data: any) {
    return this.doctorService.create(data);
  }

  @MessagePattern('doctor.update')
  async update(@Payload() updateData: { id: string, data: any }) {
    console.log('Updating user with ID:', updateData.id, 'and data:', updateData.data);
    const { id, data } = updateData;
    return this.doctorService.updateDoctor(id, data);
  }

  @MessagePattern('doctor.getAvailableWorkingTime')
  async getAvailableWorkingTime(doctorID: string) {
    return await this.doctorService.getAvailableWorkingHours(doctorID);
  }

  @MessagePattern('doctor.update-clinic-info')
  async updateClinicInfo(@Payload() id: string, @Payload() clinicData: any) {
    return this.doctorService.updateClinic(id, clinicData);
  }

  @MessagePattern('doctor.verify-doctor')
  async verifyDoctor(userId: string) {
    return this.doctorService.verifyDoctor(userId);
  }

  @MessagePattern('doctor.reject-doctor')
  async rejectDoctor(@Payload() data: { userId: string, reason: string }) {
    return this.doctorService.rejectDoctor(data.userId, data.reason);
  }

  //lay bac si co dich vu kham tai nha
  @MessagePattern('doctor.get-doctor-home-visit')
  async getDoctorHomeVisit(specialtyId: string) {
    return this.doctorService.getDoctorHomeVisit(specialtyId);
  }

  // Trong Doctor Service
  @MessagePattern('doctor.get-by-ids-with-home-service')
  async getDoctorsByIdsWithHomeService(doctorIds: string[]) {
    const doctors = await this.DoctorModel.find({
      _id: { $in: doctorIds },
      hasHomeService: true
    });

    return doctors.map(doc => ({
      _id: doc._id,
      name: doc.name,
      specialty: doc.specialty,
      address: doc.address,
      avatarURL: doc.avatarURL,
      isClinicPaused: doc.isClinicPaused,
      hasHomeService: doc.hasHomeService,
    }));
  }
}
