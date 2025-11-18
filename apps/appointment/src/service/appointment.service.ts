import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as admin from 'firebase-admin';
import { CacheService } from 'libs/cache.service';
import { Appointment, AppointmentStatus, ExaminationMethod } from '../core/schema/Appointment.schema';
import { BookAppointmentDto } from '../core/dto/appointment.dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel(Appointment.name, 'appointmentConnection') private appointmentModel: Model<Appointment>,
    @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
    @Inject('USERS_CLIENT') private usersClient: ClientProxy,
    private cacheService: CacheService,
  ) { }
  // async getDoctorStats(doctorID: string) {
  //     const patientsCount = await this.appointmentModel.countDocuments({
  //         doctor: doctorID,
  //         status: 'done',
  //     });

  //     const ratingsCount = await this.reviewModel.countDocuments({
  //         doctor: doctorID,
  //     });

  //     return { patientsCount, ratingsCount };
  // }

  // 📌 Đặt lịch hẹn
  async bookAppointment(bookData: BookAppointmentDto) {
    const { doctorID, patientID, patientModel, date, time, status, examinationMethod, reason, notes, totalCost, location } = bookData;

    const doctor = await this.doctorClient.send('doctor.get-by-id', doctorID);
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    if (doctorID === patientID) {
      throw new BadRequestException('You cannot book an appointment for yourself')
    }

    //bác sĩ không được đặt lịch hẹn cho chính mình
    if (doctorID === patientID) {
      throw new BadRequestException('You cannot book an appointment for yourself');
    }

    // Chặn nếu đã có lịch PENDING
    const pendingAppointment = await this.appointmentModel.findOne({
      doctor: doctorID,
      date,
      time,
      status: AppointmentStatus.PENDING,
    });

    if (pendingAppointment) {
      throw new BadRequestException('This time slot is already booked');
    }

    // Xóa cache lịch hẹn bệnh nhân
    this.clearPatientAppointmentCache(patientID);

    // Tìm lịch đã hủy để tái sử dụng
    const cancelledAppointment = await this.appointmentModel.findOne({
      doctor: doctorID,
      patient: patientID,
      date,
      time,
      status: AppointmentStatus.CANCELLED,
    });

    let appointment;

    if (cancelledAppointment) {
      // Cập nhật lại lịch đã huỷ
      cancelledAppointment.status = AppointmentStatus.PENDING;
      cancelledAppointment.examinationMethod = examinationMethod as ExaminationMethod || ExaminationMethod.AT_CLINIC;
      cancelledAppointment.reason = reason;
      cancelledAppointment.notes = notes;
      cancelledAppointment.totalCost = totalCost;
      cancelledAppointment.location = location;

      await cancelledAppointment.save();
      appointment = cancelledAppointment;
    } else {
      // Tạo cuộc hẹn mới
      const newAppointment = new this.appointmentModel({
        doctor: doctorID,
        patientModel,
        patient: patientID,
        date,
        time,
        status: status || AppointmentStatus.PENDING,
        examinationMethod: examinationMethod || 'at_clinic',
        reason,
        notes,
        totalCost,
        location,
      });

      await newAppointment.save();
      appointment = newAppointment;
    }

    // Thông báo và xóa cache
    await this.doctorClient.send('doctor.notify', { doctorID, message: 'Bệnh nhân đặt lịch hẹn!"' });
    await this.usersClient.send('user.notify', { userID: patientID, message: 'Bệnh nhân đặt lịch hẹn!"' });
    this.clearDoctorAppointmentCache(doctorID);

    return {
      message: 'Appointment booked successfully',
      appointment,
    };
  }

  // hàm hủy cache bác sĩ
  async clearDoctorAppointmentCache(doctorID: string) {
    const doctorCacheKey = 'all_doctor_appointments_' + doctorID;
    await this.cacheService.deleteCache(doctorCacheKey);
  }

  // hàm hủy cache bệnh nhân
  async clearPatientAppointmentCache(patientID: string) {
    const patientCacheKey = 'all_patient_appointments_' + patientID;
    await this.cacheService.deleteCache(patientCacheKey);
  }

  // 📌 Hủy lịch hẹn
  async cancelAppointment(id: string) {
    const appointment = await this.appointmentModel.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const patientID = appointment.patient.toString();
    const doctorID = appointment.doctor.toString();

    appointment.status = AppointmentStatus.CANCELLED;

    // Xóa cache bệnh nhân & bác sĩ
    await this.clearPatientAppointmentCache(patientID);
    await this.clearDoctorAppointmentCache(doctorID);

    await this.doctorClient.send('doctor.notify', { doctorID, message: "Bệnh nhân hủy lịch hẹn!" });
    await this.usersClient.send('user.notify', { userID: patientID, message: "Bệnh nhân hủy lịch hẹn!" });
    await appointment.save();

    return { message: 'Appointment cancelled successfully' };
  }

  // 📌 Xác nhận lịch hẹn
  async confirmAppointmentDone(id: string) {
    const appointment = await this.appointmentModel.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const patientID = appointment.patient.toString();
    const doctorID = appointment.doctor.toString();

    // Xóa cache bệnh nhân & bác sĩ
    await this.clearPatientAppointmentCache(patientID);
    await this.clearDoctorAppointmentCache(doctorID);

    appointment.status = AppointmentStatus.DONE;

    await this.doctorClient.send('doctor.notify', { doctorID, message: "Lịch hẹn của bệnh nhân đã hoàn thành!" });
    await this.usersClient.send('user.notify', { userID: patientID, message: "Lịch hẹn của bệnh nhân đã hoàn thành!" });
    await appointment.save();

    return { message: 'Appointment confirmed done successfully', appointment };
  }

  // 📌 Lấy danh sách tất cả lịch hẹn
  async getAllAppointments() {
    const cacheKey = 'appointments_cache';
    console.log('Trying to get all appointments from cache...');

    const cached = await this.cacheService.getCache(cacheKey);
    if (cached) {
      console.log('Cache HIT');
      return cached;
    }

    console.log('Cache MISS - querying DB');

    const appointmentsRaw = await this.appointmentModel.find()
      .populate({
        path: 'doctor',
        match: { isDeleted: false },
        select: 'name specialty hospital address',
        populate: {
          path: 'specialty',
          select: 'name avatarURL',
        },
      })
      .populate({
        path: 'patient',
        match: { isDeleted: false },
        select: '_id name',
      });

    const appointments = appointmentsRaw.filter(appt => appt.doctor && appt.patient);
    await this.cacheService.setCache(cacheKey, appointments, 10000); //cache for 30 seconds

    return appointments;
  }

  // Lấy danh sách lịch hẹn của bác sĩ
  async getDoctorAppointments(doctorID: string) {
    const doctor = await this.doctorClient.send('doctor.get-by-id', { id: doctorID });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const cacheKey = 'all_doctor_appointments_' + doctorID;
    console.log('Trying to get doctor appointments from cache...');

    const cached = await this.cacheService.getCache(cacheKey);
    if (cached) {
      console.log('Cache doctor appointments HIT');
      return cached;
    }

    console.log('Cache MISS - querying DB');
    const appointmentsRaw = await this.appointmentModel.find({ doctor: doctorID })
      .populate({
        path: 'doctor',
        match: { isDeleted: false },
        select: 'name avatarURL'
      })
      .populate({
        path: 'patient',
        match: { isDeleted: false },
        select: 'name'
      });

    const appointments = appointmentsRaw
      .filter((appt) => appt.doctor !== null && appt.patient !== null)
      .sort((a, b) => {
        const dateA = new Date(`${a.date.toISOString().split('T')[0]}T${a.time}`);
        const dateB = new Date(`${b.date.toISOString().split('T')[0]}T${b.time}`);
        return dateB.getTime() - dateA.getTime();
      });


    if (!appointments) {
      throw new NotFoundException('No appointments found for this doctor');
    }

    console.log('Setting cache...');
    await this.cacheService.setCache(cacheKey, appointments, 30 * 1000); // Cache for 1 hour

    return appointments;
  }

  // 📌 Lấy danh sách lịch hẹn của bệnh nhân
  async getPatientAppointments(patientID: string) {
    var patient = await this.usersClient.send('user.getuserbyid', { id: patientID });
    if (!patient) {
      patient = await this.doctorClient.send('doctor.get-by-id', { id: patientID });
    }

    const cacheKey = 'all_patient_appointments_' + patientID;
    console.log('Trying to get patient appointments from cache...');

    const cached = await this.cacheService.getCache(cacheKey);
    if (cached) {
      console.log('Cache patient appointments HIT');
      return cached;
    }

    console.log('Cache MISS - querying DB');
    const appointmentsRaw = await this.appointmentModel.find({ patient: patientID })
      .populate({ path: 'doctor', match: { isDeleted: false }, select: 'name avatarURL' })
      .populate({ path: 'patient', select: 'name' });

    const appointments = appointmentsRaw
      .filter(appt => appt.doctor !== null)
      .sort((a, b) => {
        const dateA = new Date(`${a.date.toISOString().split('T')[0]}T${a.time}`);
        const dateB = new Date(`${b.date.toISOString().split('T')[0]}T${b.time}`);
        return dateB.getTime() - dateA.getTime(); // Mới nhất trước
      });

    if (!appointments) {
      throw new NotFoundException('No appointments found for this patient');
    }

    console.log('Setting cache...');
    await this.cacheService.setCache(cacheKey, appointments, 30 * 1000); // Cache for 1 hour

    return appointments;
  }

  // 📌 Lấy danh sách lịch hẹn theo status
  async getAppointmentsByStatus(patientID: string, status: string): Promise<Appointment[]> {
    const rawAppointments = await this.appointmentModel.find({
      patient: patientID,
      status: status,
    }).populate({
      path: 'doctor',
      match: { isDeleted: false },
      select: 'name',
    });

    const appointments = rawAppointments.filter(appt => appt.doctor !== null);
    return appointments;
  }


  async getAppointmentsbyitsID(id: string) {
    const appointment = await this.appointmentModel.findById(id);
    return appointment;
  }

  async updateAppointment(id: string, updateData: Partial<BookAppointmentDto>) {
    const appointment = await this.appointmentModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const patientID = appointment.patient.toString();
    const doctorID = appointment.doctor.toString();

    const patientCacheKey = 'all_patient_appointments_' + patientID;
    const doctorCacheKey = 'all_doctor_appointments_' + doctorID;
    await this.cacheService.deleteCache(patientCacheKey);
    await this.cacheService.deleteCache(doctorCacheKey);

    return { message: 'Appointment updated successfully', appointment };
  }


  async deleteAppointment(id: string) {
    const appointment = await this.appointmentModel.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const patientID = appointment.patient.toString();
    const doctorID = appointment.doctor.toString();

    // Xóa lịch hẹn
    await this.appointmentModel.findByIdAndDelete(id);

    // Xóa cache bệnh nhân & bác sĩ
    const patientCacheKey = 'all_patient_appointments_' + patientID;
    const doctorCacheKey = 'all_doctor_appointments_' + doctorID;
    await this.cacheService.deleteCache(patientCacheKey);
    await this.cacheService.deleteCache(doctorCacheKey);

    return { message: 'Appointment deleted successfully' };
  }
}
