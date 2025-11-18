import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Doctor } from '../core/schema/doctor.schema';
import { CacheService } from 'libs/cache.service';
import * as bcrypt from 'bcrypt';
import * as admin from 'firebase-admin';
import { ClientProxy } from '@nestjs/microservices';
import { PendingDoctor } from '../core/schema/PendingDoctor.schema';
import { lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(Doctor.name, 'doctorConnection') private DoctorModel: Model<Doctor>,
    @InjectModel(PendingDoctor.name, 'doctorConnection') private pendingDoctorModel: Model<PendingDoctor>,
    @Inject('USERS_CLIENT') private usersClient: ClientProxy,
    @Inject('SPECIALTY_CLIENT') private specialtyClient: ClientProxy,
    @Inject('APPOINTMENT_CLIENT') private appointmentClient: ClientProxy,
    private cacheService: CacheService,
  ) { }
  async getDoctorById(id: string) {
    console.log('Received doctor ID:', id, typeof id);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const objectId = new Types.ObjectId(id);

    // const cacheKey = `doctor_${id}`;
    // console.log('Trying to get doctor by id from cache...');

    // const cached = await this.cacheService.getCache(cacheKey);
    // if (cached) {
    //   console.log('Cache HIT');
    //   return cached;
    // }

    console.log('Cache MISS - querying DB');
    const doctor = await this.DoctorModel.findById(objectId);

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy bác sĩ');
    }

    const specialtyId = doctor.specialty?.toString();

    if (!specialtyId) {
      return doctor;
    }

    // Lấy thông tin specialty chi tiết
    const specialties = await this.specialtyClient
      .send('specialty.get-by-ids', { specialtyIds: [specialtyId] })
      .toPromise();

    // Map specialty data vào doctor object
    const doctorObj = doctor.toObject();
    const specialtyData = specialties.find(
      s => s._id.toString() === specialtyId
    );

    const result = {
      ...doctorObj,
      specialty: specialtyData || doctorObj.specialty
    };

    console.log('Setting cache...');
    // await this.cacheService.setCache(cacheKey, result, 30 * 1000);

    return result;
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

  async update(id: string, updateDoctorDto: any) {
    return this.DoctorModel.findByIdAndUpdate(id, updateDoctorDto);
  }

  //Lấy thời gian làm việc chưa được đặt 
  async getAvailableWorkingHours(
    doctorID: string,
    numberOfDays: number = 14,
    specificDate?: string,
  ) {


    // if (!Types.ObjectId.isValid(doctorID)) {
    //   throw new BadRequestException('Invalid doctor ID');
    // }

    // const objectId = new Types.ObjectId(doctorID);

    const doctor = await this.DoctorModel.findById(doctorID);
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (!doctor.workingHours || doctor.workingHours.length === 0) {
      return {
        doctorID,
        doctorName: doctor.name,
        availableSlots: [],
        message: 'Doctor has not set working hours',
      };
    }

    const startDate = specificDate ? new Date(specificDate) : new Date();
    if (specificDate && isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid specific date format');
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (specificDate ? 1 : numberOfDays));

    console.log('doctorID', doctorID, 'startDate', startDate, 'endDate', endDate, 'specificDate', specificDate, 'numberOfDays', numberOfDays);
    const bookedAppointments = await lastValueFrom(
      this.appointmentClient.send('appointment.getDoctorBookAppointment', {
        doctorID: doctorID,
        startDate: startDate.toISOString(), // Convert to string
        endDate: endDate.toISOString()      // Convert to string
      }).pipe(timeout(3000))
    );
    const availableSlots: any[] = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const jsDay = currentDate.getDay();
      const dateString = currentDate.toISOString().split('T')[0];

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      if (currentDate < todayStart && !specificDate) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      let dbDay: number;
      switch (jsDay) {
        case 0: // Sunday
          dbDay = 7;
          break;
        case 1: // Monday  
          dbDay = 8; // Assuming 8 is Monday based on your data pattern
          break;
        case 2: // Tuesday
          dbDay = 2;
          break;
        case 3: // Wednesday
          dbDay = 3;
          break;
        case 4: // Thursday
          dbDay = 4;
          break;
        case 5: // Friday
          dbDay = 5;
          break;
        case 6: // Saturday
          dbDay = 6;
          break;
        default:
          dbDay = jsDay;
      }

      // Get working hours for this day
      const workingHoursForDay = doctor.workingHours.filter(
        (wh) => wh.dayOfWeek === dbDay,
      );

      if (workingHoursForDay.length > 0) {
        // Sort working hours by time
        const sortedWorkingHours = workingHoursForDay.sort((a, b) => {
          if (a.hour !== b.hour) return a.hour - b.hour;
          return a.minute - b.minute;
        });

        // Get booked times for this day
        const bookedTimesForDay = bookedAppointments
          .filter((apt) => {
            const aptDateString = apt.date instanceof Date
              ? apt.date.toISOString().split('T')[0]
              : apt.date;
            return aptDateString === dateString;
          })
          .map((apt) => apt.time);

        // Filter out slots that are booked or in the past
        const availableSlotsForDay = sortedWorkingHours
          .filter((wh) => {
            const timeString = `${wh.hour.toString().padStart(2, '0')}:${wh.minute
              .toString()
              .padStart(2, '0')}`;


            if (dateString === new Date().toISOString().split('T')[0]) {
              const currentTime = new Date();
              const slotTime = new Date(currentDate);
              slotTime.setHours(wh.hour, wh.minute, 0, 0);

              // Thêm 30 phút đệm
              const bufferTime = new Date(currentTime.getTime() + 30 * 60 * 1000);

              if (slotTime <= bufferTime) {
                return false;
              }
            }

            // kiểm tra xem thời gian này đã được đặt hay chưa
            return !bookedTimesForDay.includes(timeString);
          })
          .map((wh) => ({
            workingHourId: `${wh.dayOfWeek}-${wh.hour}-${wh.minute}`,
            time: `${wh.hour.toString().padStart(2, '0')}:${wh.minute
              .toString()
              .padStart(2, '0')}`,
            hour: wh.hour,
            minute: wh.minute,
            displayTime: this.formatDisplayTime(wh.hour, wh.minute),
          }));

        if (availableSlotsForDay.length > 0) {
          availableSlots.push({
            date: dateString,
            dayOfWeek: jsDay,
            dayName: this.getDayName(jsDay),
            displayDate: this.formatDisplayDate(currentDate),
            slots: availableSlotsForDay,
            totalSlots: availableSlotsForDay.length,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const result = {
      doctorID,
      doctorName: doctor.name,
      searchPeriod: {
        from: startDate.toISOString().split('T')[0],
        to: new Date(endDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], //trừ 1 ngày để không bao gồm ngày kết thúc
        numberOfDays: specificDate ? 1 : numberOfDays,
      },
      availableSlots,
      totalAvailableDays: availableSlots.length,
      totalAvailableSlots: availableSlots.reduce(
        (sum, day) => sum + day.totalSlots,
        0,
      ),
    };

    return result;
  }

  // Format giờ hiển thị
  private formatDisplayTime(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private getDayName(dayOfWeek: number): string {
    const days = [
      'Sunday',    // 0
      'Monday',    // 1
      'Tuesday',   // 2
      'Wednesday', // 3
      'Thursday',  // 4
      'Friday',    // 5
      'Saturday',  // 6
    ];
    return days[dayOfWeek];
  }

  private formatDisplayDate(date: Date): string {
    const displayDate = new Date(date.getTime());

    return displayDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

}
