import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Doctor } from '../core/schema/doctor.schema';
import { CacheService } from 'libs/cache.service';
import * as bcrypt from 'bcrypt';
import * as admin from 'firebase-admin';
import { ClientProxy } from '@nestjs/microservices';
import { PendingDoctor, PendingDoctorStatus } from '../core/schema/PendingDoctor.schema';
import { Specialty } from 'apps/specialty/src/core/schema/specialty.schema';
import { lastValueFrom, timeout } from 'rxjs';
import { MediaUrlHelper } from 'libs/media-url.helper';

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(Doctor.name, 'doctorConnection') private DoctorModel: Model<Doctor>,
    @InjectModel(PendingDoctor.name, 'doctorConnection') private pendingDoctorModel: Model<PendingDoctor>,
    @Inject('USERS_CLIENT') private usersClient: ClientProxy,
    @Inject('SPECIALTY_CLIENT') private specialtyClient: ClientProxy,
    @Inject('APPOINTMENT_CLIENT') private appointmentClient: ClientProxy,
    @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,
    @Inject('REVIEW_CLIENT') private reviewClient: ClientProxy,
    private cacheService: CacheService,
    private readonly mediaUrlHelper: MediaUrlHelper,
  ) { }
  async getDoctorById(id: string) {
    //console.log('Received doctor ID:', id, typeof id);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const objectId = new Types.ObjectId(id);

    const cacheKey = `doctor_${objectId}`;
    //console.log('Trying to get doctor by id from cache...');

    const cached = await this.cacheService.getCache(cacheKey);
    if (cached) {
      //console.log('Cache HIT');
      return this.mediaUrlHelper.constructObjectUrls(cached, [
        'avatarURL', 'licenseUrl', 'frontCccdUrl', 'backCccdUrl', 'faceUrl', 'services'
      ]);
    }

    //console.log('Cache MISS - querying DB');
    const doctor = await this.DoctorModel.findById(objectId);

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy bác sĩ');
    }

    const specialtyId = doctor.specialty?.toString();

    if (!specialtyId) {
      return this.mediaUrlHelper.constructObjectUrls(doctor, [
        'avatarURL', 'licenseUrl', 'frontCccdUrl', 'backCccdUrl', 'faceUrl', 'services'
      ]);
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

    //console.log('Setting cache...');
    await this.cacheService.setCache(cacheKey, result, 30 * 1000);
    //console.log('Ket qua tra ve: ' + result);

    return this.mediaUrlHelper.constructObjectUrls(result, [
      'avatarURL', 'licenseUrl', 'frontCccdUrl', 'backCccdUrl', 'faceUrl', 'services'
    ]);
  }

  async getAllDoctor() {
    const doctors = await this.DoctorModel.find();

    const specialtyIds = [...new Set(
      doctors
        .map(doc => doc.specialty?.toString())
        .filter(Boolean)
    )];

    if (specialtyIds.length === 0) {
      return this.mediaUrlHelper.constructArrayUrls(doctors, [
        'avatarURL', 'licenseUrl', 'frontCccdUrl', 'backCccdUrl', 'faceUrl', 'services'
      ]);
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

      const result = {
        ...doctorObj,
        specialty: specialtyData || doctorObj.specialty
      };

      return this.mediaUrlHelper.constructObjectUrls(result, [
        'avatarURL', 'licenseUrl', 'frontCccdUrl', 'backCccdUrl', 'faceUrl', 'services'
      ]);
    });
  }

  async getAllWithFilter(limit: number, skip: number, searchText?: string) {
    let filter: any = { isDeleted: false };
    if (searchText && searchText.trim() !== '') {
      filter.$or = [
        { name: { $regex: searchText, $options: 'i' } },
        { degree: { $regex: searchText, $options: 'i' } },
      ];
    }

    const total = await this.DoctorModel.countDocuments(filter);

    const doctors = await this.DoctorModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Lấy thông tin specialty chi tiết (tái sử dụng logic từ getAllDoctor)
    const specialtyIds = [...new Set(
      doctors
        .map(doc => doc.specialty?.toString())
        .filter(Boolean)
    )];

    if (specialtyIds.length === 0) {
      const doctorsWithURLs = this.mediaUrlHelper.constructArrayUrls(doctors, [
        'avatarURL', 'licenseUrl', 'frontCccdUrl', 'backCccdUrl', 'faceUrl', 'services'
      ]);
      return { doctors: doctorsWithURLs, total };
    }

    const specialties = await this.specialtyClient
      .send('specialty.get-by-ids', { specialtyIds })
      .toPromise();

    const doctorsWithSpecialty = doctors.map(doc => {
      const doctorObj = doc.toObject();
      const specialtyId = doc.specialty?.toString();
      const specialtyData = specialties.find(
        s => s._id.toString() === specialtyId
      );

      const result = {
        ...doctorObj,
        specialty: specialtyData || doctorObj.specialty
      };

      return this.mediaUrlHelper.constructObjectUrls(result, [
        'avatarURL', 'licenseUrl', 'frontCccdUrl', 'backCccdUrl', 'faceUrl', 'services'
      ]);
    });

    return { data: doctorsWithSpecialty, total };
  }

  async getDoctorBySpecialtyID(specialtyId: string) {
    return this.DoctorModel.find({ specialty: new Types.ObjectId(specialtyId) });
  }

  async updateFcmToken(doctorId: string, token: string) {
    try {
      const doctor = await this.DoctorModel.findByIdAndUpdate(
        doctorId,  // String, Mongoose tự convert sang ObjectId
        { fcmToken: token },
        { new: true }
      );

      if (!doctor) {
        throw new Error('Doctor not found');
      }

      console.log('Doctor FCM token updated successfully');
      return { success: true, fcmToken: token };
    } catch (error) {
      console.error('Error updating doctor FCM token:', error);
      throw error;
    }
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
      //console.log("bac si thong bao ", doctor);
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
    const pendingDoctors = await this.pendingDoctorModel.find({ status: { $ne: PendingDoctorStatus.REJECTED } });
    return this.mediaUrlHelper.constructArrayUrls(pendingDoctors, [
      'avatarURL', 'licenseUrl', 'frontCccdUrl', 'backCccdUrl', 'faceUrl'
    ]);
  }

  async getRejectedDoctors() {
    return this.pendingDoctorModel.find({ status: PendingDoctorStatus.REJECTED });
  }

  async getPendingDoctorById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    const objectId = new Types.ObjectId(id);
    return this.pendingDoctorModel.findById(objectId);
  }

  async createPendingDoctor(data: any) {
    return this.pendingDoctorModel.create({ ...data, status: PendingDoctorStatus.PENDING });
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
    console.log("ID nhan duoc: ", id);
    console.log("Du lieu can cap nhat: ", updateDoctorDto);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const objectId = new Types.ObjectId(id);

    const doctor = await this.DoctorModel.findById(objectId);
    if (!doctor) {
      throw new BadRequestException('Bác sĩ không tồn tại');
    }

    // Danh sách các trường hợp lệ (ĐÃ BỔ SUNG CÁC TRƯỜNG URL CỦA ẢNH)
    const allowedFields = [
      'name',
      'email',
      'phone',
      'password',
      'specialty',
      'experience',
      'description',
      'hospital',
      'address',
      'price',
      'cccd',
      'insurance',
      'workingHours',
      'minAge',
      'certificates',
      'services',
      'patientsCount',
      'ratingsCount',
      'avatarURL',
      'licenseUrl',
      'frontCccdUrl',
      'backCccdUrl'
    ];

    // Lọc dữ liệu hợp lệ
    const filteredUpdateData = {};

    // Nếu dữ liệu được gửi trong profileData, lấy từ đó
    const dataToUpdate = updateDoctorDto.profileData || updateDoctorDto;

    // Tự động map các trường cơ bản (bao gồm cả các URL nếu client có gửi lên)
    Object.keys(dataToUpdate).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdateData[key] = dataToUpdate[key];
      }
    });

    // =========================================================
    // XỬ LÝ ẢNH & MEDIA (Ưu tiên File Buffer ghi đè lên URL cũ)
    // =========================================================

    // 1. Xử lý tải lên giấy phép
    if (dataToUpdate.licenseUrl) {
      filteredUpdateData['licenseUrl'] = dataToUpdate.licenseUrl;
      console.log('Using pre-uploaded license URL:', dataToUpdate.licenseUrl);
    } else if (dataToUpdate.license) {
      try {
        const uploadResult = await this.mediaClient
          .send('media.upload', {
            buffer: dataToUpdate.license.buffer,
            filename: dataToUpdate.license.originalname,
            mimetype: dataToUpdate.license.mimetype,
            folder: `doctor/${objectId}/license`,
          })
          .toPromise();
        filteredUpdateData['licenseUrl'] = uploadResult.relative_path;
        console.log('Giấy phép đã được tải lên. Relative path:', uploadResult.relative_path);
      } catch (error) {
        console.error('Lỗi Media:', error);
        throw new BadRequestException('Lỗi khi tải giấy phép lên Media');
      }
    }

    // 2. Xử lý tải lên ảnh hồ sơ (avatar / image)
    if (dataToUpdate.avatarURL) {
      filteredUpdateData['avatarURL'] = dataToUpdate.avatarURL;
      console.log('Using pre-uploaded avatar URL:', dataToUpdate.avatarURL);
    } else if (dataToUpdate.image) {
      try {
        const uploadResult = await this.mediaClient
          .send('media.upload', {
            buffer: dataToUpdate.image.buffer,
            filename: dataToUpdate.image.originalname,
            mimetype: dataToUpdate.image.mimetype,
            folder: `doctor/${objectId}/avatar`,
          })
          .toPromise();
        filteredUpdateData['avatarURL'] = uploadResult.relative_path;
        console.log('Ảnh hồ sơ đã được tải lên. Relative path:', uploadResult.relative_path);
      } catch (error) {
        console.error('Lỗi Media:', error);
        throw new BadRequestException('Lỗi khi tải ảnh hồ sơ lên Media');
      }
    }

    // 3. Xử lý tải lên mặt trước CCCD
    if (dataToUpdate.frontCccdUrl) {
      filteredUpdateData['frontCccdUrl'] = dataToUpdate.frontCccdUrl;
      console.log('Using pre-uploaded Front CCCD URL:', dataToUpdate.frontCccdUrl);
    } else if (dataToUpdate.frontCccd) {
      try {
        const uploadResult = await this.mediaClient
          .send('media.upload', {
            buffer: dataToUpdate.frontCccd.buffer,
            filename: dataToUpdate.frontCccd.originalname,
            mimetype: dataToUpdate.frontCccd.mimetype,
            folder: `doctor/${objectId}/info`,
          })
          .toPromise();
        filteredUpdateData['frontCccdUrl'] = uploadResult.relative_path;
        console.log('Front Cccd đã được tải lên. Relative path:', uploadResult.relative_path);
      } catch (error) {
        console.error('Lỗi Media:', error);
        throw new BadRequestException('Lỗi khi tải front Cccd lên Media');
      }
    }

    // 4. Xử lý tải lên mặt sau CCCD
    if (dataToUpdate.backCccdUrl) {
      filteredUpdateData['backCccdUrl'] = dataToUpdate.backCccdUrl;
      console.log('Using pre-uploaded Back CCCD URL:', dataToUpdate.backCccdUrl);
    } else if (dataToUpdate.backCccd) {
      try {
        const uploadResult = await this.mediaClient
          .send('media.upload', {
            buffer: dataToUpdate.backCccd.buffer,
            filename: dataToUpdate.backCccd.originalname,
            mimetype: dataToUpdate.backCccd.mimetype,
            folder: `doctor/${objectId}/info`,
          })
          .toPromise();
        filteredUpdateData['backCccdUrl'] = uploadResult.relative_path;
        console.log('Back Cccd đã được tải lên. Relative path:', uploadResult.relative_path);
      } catch (error) {
        console.error('Lỗi Media:', error);
        throw new BadRequestException('Lỗi khi tải back Cccd lên Media');
      }
    }

    // =========================================================

    // Xử lý cập nhật chuyên khoa
    if (dataToUpdate.specialty) {
      const specialtyId = dataToUpdate.specialty;
      const specialtyObj = new Types.ObjectId(specialtyId);

      const specialty = await this.specialtyClient
        .send('specialty.get-by-id', specialtyObj)
        .toPromise();

      if (!specialty) {
        throw new BadRequestException('Chuyên khoa không tồn tại');
      }

      // Xóa bác sĩ khỏi chuyên khoa cũ
      if (doctor.specialty) {
        await this.specialtyClient
          .send('specialty.delete-doctor-specialties', {
            doctorId: objectId,
            specialtyIds: doctor.specialty
          })
          .toPromise();
      }

      // Thêm bác sĩ vào chuyên khoa mới
      await this.specialtyClient
        .send('specialty.update-doctor-specialties', {
          doctorId: objectId,
          specialtyIds: specialtyObj
        })
        .toPromise();
    }

    console.log('Thông tin cập nhật bác sĩ:', {
      objectId,
      updatedFields: Object.keys(filteredUpdateData),
      updatedData: filteredUpdateData
    });

    // Cập nhật thông tin bác sĩ
    const updatedDoctor = await this.DoctorModel.findByIdAndUpdate(
      objectId,
      { $set: filteredUpdateData },
      { new: true },
    ).populate('specialty');

    if (!updatedDoctor) {
      throw new BadRequestException('Cập nhật thất bại!');
    }

    return {
      message: 'Cập nhật hồ sơ thành công!',
      updatedDoctor,
    };
  }

  //Lấy thời gian làm việc chưa được đặt 
  async getAvailableWorkingHours(
    doctorID: string,
    numberOfDays: number = 14,
    specificDate?: string,
  ) {
    const doctor = await this.DoctorModel.findById(doctorID).lean();
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

    // XỬ LÝ NGÀY 
    const startDate = specificDate ? new Date(specificDate) : new Date();
    if (specificDate && isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid specific date format');
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (specificDate ? 1 : numberOfDays));

    // LẤY APPOINTMENT ĐÃ ĐẶT 
    const bookedAppointments = await lastValueFrom(
      this.appointmentClient
        .send('appointment.getDoctorBookAppointment', {
          doctorID,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .pipe(timeout(5000)),
    );

    const bookedMap = new Map<string, Set<string>>();
    for (const apt of bookedAppointments) {
      if (!bookedMap.has(apt.date)) {
        bookedMap.set(apt.date, new Set());
      }
      bookedMap.get(apt.date)!.add(apt.time);
    }

    const availableSlots: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 30 * 60 * 1000);

    //DUYỆT TỪNG NGÀY 
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const jsDay = currentDate.getUTCDay(); // 0–6
      const dateString = currentDate.toISOString().split('T')[0];

      // Bỏ qua ngày quá khứ (trừ khi chọn specificDate)
      if (!specificDate && dateString < today) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const dbDayMap = { 0: 8, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7 };
      const dbDay = dbDayMap[jsDay];

      const workingHoursForDay = doctor.workingHours
        .filter(wh => wh.dayOfWeek === dbDay)
        .sort((a, b) =>
          a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute,
        );

      if (workingHoursForDay.length === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const bookedTimes = bookedMap.get(dateString) ?? new Set();

      const slots = workingHoursForDay
        .filter(wh => {
          const time = `${wh.hour.toString().padStart(2, '0')}:${wh.minute
            .toString()
            .padStart(2, '0')}`;

          // Đã có người đặt
          if (bookedTimes.has(time)) return false;

          // Quá gần hiện tại (chỉ áp dụng cho hôm nay)
          if (dateString === today) {
            const slotTime = new Date(currentDate);
            slotTime.setHours(wh.hour, wh.minute, 0, 0);
            if (slotTime <= bufferTime) return false;
          }

          return true;
        })
        .map(wh => ({
          workingHourId: `${wh.dayOfWeek}-${wh.hour}-${wh.minute}`,
          time: `${wh.hour.toString().padStart(2, '0')}:${wh.minute
            .toString()
            .padStart(2, '0')}`,
          hour: wh.hour,
          minute: wh.minute,
          displayTime: this.formatDisplayTime(wh.hour, wh.minute),
        }));

      if (slots.length > 0) {
        availableSlots.push({
          date: dateString,
          dayOfWeek: dbDay,
          dayName: this.getDayName(jsDay),
          displayDate: this.formatDisplayDate(currentDate),
          slots,
          totalSlots: slots.length,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // ====== RESULT ======
    return {
      doctorID,
      doctorName: doctor.name,
      searchPeriod: {
        from: startDate.toISOString().split('T')[0],
        to: new Date(endDate.getTime() - 86400000)
          .toISOString()
          .split('T')[0],
        numberOfDays: specificDate ? 1 : numberOfDays,
      },
      availableSlots,
      totalAvailableDays: availableSlots.length,
      totalAvailableSlots: availableSlots.reduce(
        (sum, d) => sum + d.totalSlots,
        0,
      ),
    };
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

  // // Xác thực tài khoản bác sĩ bởi admin
  // async verifyDoctor(userId: string) {
  //   const pendingDoctor = await this.pendingDoctorModel.findOne({ userId });
  //   if (!pendingDoctor)
  //     throw new NotFoundException(
  //       'Người dùng không tồn tại trong bảng chờ phê duyệt.',
  //     );

  //   // Lấy thông tin user từ bảng User
  //   const user = await lastValueFrom(this.usersClient.send('user.getuserbyid', userId));
  //   if (!user) throw new NotFoundException('Người dùng không tồn tại.');


  //   // Xóa khỏi bảng PendingDoctors và cập nhật bảng Doctors
  //   await this.DoctorModel.create({
  //     _id: userId,
  //     name: user.name,
  //     email: user.email,
  //     phone: user.phone,
  //     password: user.password,
  //     verified: true,
  //     cccd: pendingDoctor.CCCD,
  //     avatarURL: pendingDoctor.avatarURL,
  //     frontCccdUrl: pendingDoctor.frontCccdUrl,
  //     backCccdUrl: pendingDoctor.backCccdUrl,
  //     address: "chua co dia chi",
  //     licenseUrl: pendingDoctor.licenseUrl,
  //     certificates: pendingDoctor.certificates,
  //     experience: pendingDoctor.experience,
  //     specialty: pendingDoctor.specialty,
  //     isDeleted: pendingDoctor.isDeleted,
  //   });
  //   await this.pendingDoctorModel.deleteOne({ userId });
  //   await this.usersClient.send('user.delete', userId);
  //   await this.SpecialtyModel.findByIdAndUpdate(
  //     pendingDoctor.specialty,
  //     { $push: { doctors: userId } },
  //   );

  //   //xoa cache
  //   const cacheKey = 'pending_doctors';
  //   await this.cacheService.deleteCache(cacheKey);

  //   return {
  //     message: 'Xác thực bác sĩ thành công!',
  //   };
  // }

  async updateClinic(
    doctorId: string,
    updateData: any,
    files?: { serviceImage?: Express.Multer.File[] }
  ) {
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const doctor = await this.DoctorModel.findById(doctorId);
    if (!doctor) {
      throw new BadRequestException('Bác sĩ không tồn tại');
    }

    // Parse & filter dữ liệu đầu vào
    const filteredData = this.filterAllowedFields(updateData);
    const uploadedImages = await this.uploadServiceImages(files?.serviceImage, doctorId);

    // Xử lý services nếu có
    if (Array.isArray(filteredData.services)) {
      filteredData.services = await this.mergeServices(doctorId, filteredData.oldService, filteredData.services, uploadedImages);
    }

    // Xử lý workingHours nếu có
    if (Array.isArray(filteredData.workingHours)) {
      filteredData.workingHours = this.mergeWorkingHours(filteredData.oldWorkingHours, filteredData.workingHours);
    }

    // Gán và lưu
    await Object.assign(doctor, filteredData);
    await doctor.save();
    await this.cacheService.deleteCache(`doctor_${doctorId}`);

    return {
      message: 'Cập nhật thông tin phòng khám thành công',
      data: doctor,
    };
  }

  private filterAllowedFields(data: any) {
    const allowed = ['description', 'address', 'services', 'workingHours', 'oldService', 'oldWorkingHours', 'hasHomeService', 'isClinicPaused'];
    const filtered: any = {};
    for (const key of allowed) {
      if (key in data) {
        if (key === 'hasHomeService' || key === 'isClinicPaused') {
          // Chuyển đổi sang boolean nếu là chuỗi
          filtered[key] = data[key] === 'true' || data[key] === true;
        } else {
          filtered[key] = data[key];
        }
      }
    }
    return filtered;
  }

  private async uploadServiceImages(files: Express.Multer.File[] = [], doctorId: string): Promise<string[]> {
    const uploaded: string[] = [];

    for (const file of files) {
      //const result = await this.mediaService.uploadFile(file, `Doctors/${doctorId}/Services`);
      const uploadResult = await this.mediaClient
        .send('media.upload', {
          buffer: file.buffer,
          filename: file.originalname,
          mimetype: file.mimetype,
          folder: `doctor/${doctorId}/services`,
        })
        .toPromise();

      uploaded.push(uploadResult.relative_path);
    }

    return uploaded;
  }

  private async mergeServices(doctorId, existingServices: any[], newServices: any[], uploadedImages: string[]) {
    const updatedServices = [...existingServices];
    let uploadIndex = 0;

    for (const service of newServices) {
      const imageList = uploadedImages?.length
        ? uploadedImages.filter(Boolean)
        : service.imageService ?? [];

      const newService = {
        _id: new Types.ObjectId().toString(),
        description: service.description,
        maxprice: Number(service.maxprice),
        minprice: Number(service.minprice),
        imageService: imageList,
        specialtyId: service.specialtyId,
        specialtyName: service.specialtyName,
      };

      uploadIndex++;
      updatedServices.push(newService);

      // Đảm bảo bác sĩ được gắn vào chuyên khoa này (chỉ thêm nếu chưa có)
      // await this.SpecialtyModel.findByIdAndUpdate(
      //   service.specialtyId,
      //   { $addToSet: { doctors: doctorId } }  // Tránh trùng
      // );

      await this.specialtyClient
        .send('specialty.update-doctor-specialties', {
          doctorId: new Types.ObjectId(doctorId),
          specialtyIds: new Types.ObjectId(service.specialtyId)
        })
        .toPromise();
    }

    return updatedServices;
  }

  private mergeWorkingHours(existingWH: any[], newWHList: any[]): any[] {
    const updatedWH = [...(existingWH || [])];

    for (const newWH of newWHList) {
      const isDuplicate = updatedWH.some(
        (wh) =>
          wh.dayOfWeek === newWH.dayOfWeek &&
          wh.hour === newWH.hour &&
          wh.minute === newWH.minute
      );

      if (!isDuplicate) {
        updatedWH.push({
          dayOfWeek: Number(newWH.dayOfWeek),
          hour: Number(newWH.hour),
          minute: Number(newWH.minute),
        });
      }
    }

    return updatedWH;
  }



  async verifyDoctor(userId: string) {
    console.log('userId: ', userId);
    // 1. Check PendingDoctor
    const pendingDoctor = await this.pendingDoctorModel.findOne({ userId });
    if (!pendingDoctor)
      throw new NotFoundException(
        'Người dùng không tồn tại trong bảng chờ phê duyệt.',
      );

    // 2. Fetch User data via usersClient
    // Use lastValueFrom + timeout to handle microservice communication safely
    let user;
    try {
      user = await lastValueFrom(
        this.usersClient.send('user.getuserbyid', userId).pipe(timeout(5000))
      );
    } catch (e) {
      console.error('Lỗi khi gọi user.getuserbyid:', e);
      throw new NotFoundException('Không thể lấy thông tin người dùng từ service Users.');
    }

    if (!user) throw new NotFoundException('Người dùng không tồn tại.');

    // 3. Create Doctor record
    const newDoctor = await this.DoctorModel.create({
      _id: userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: user.password,
      verified: true,
      cccd: pendingDoctor.CCCD,
      avatarURL: pendingDoctor.avatarURL,
      frontCccdUrl: pendingDoctor.frontCccdUrl,
      backCccdUrl: pendingDoctor.backCccdUrl,
      address: pendingDoctor.address,
      licenseUrl: pendingDoctor.licenseUrl,
      certificates: pendingDoctor.certificates,
      experience: pendingDoctor.experience,
      specialty: pendingDoctor.specialty,
      isDeleted: pendingDoctor.isDeleted,
    });

    // 4. Delete PendingDoctor
    await this.pendingDoctorModel.deleteOne({ userId });

    // 5. Delete User (Hard Delete) via usersClient
    try {
      await lastValueFrom(
        this.usersClient.send('user.hard-delete', userId).pipe(timeout(5000))
      );
    } catch (e) {
      console.warn('Lỗi khi gọi user.hard-delete (không ảnh hưởng luồng chính):', e);
    }

    // 6. Update Specialty
    try {
      if (pendingDoctor.specialty) {
        await lastValueFrom(
          this.specialtyClient.send('specialty.update-doctor-specialties', {
            doctorId: new Types.ObjectId(userId),
            specialtyIds: pendingDoctor.specialty
          }).pipe(timeout(5000))
        );
      }
    } catch (e) {
      console.warn('Lỗi khi cập nhật specialty (không ảnh hưởng luồng chính):', e);
    }

    // Clear cache if needed
    const cacheKey = 'pending_doctors';
    await this.cacheService.deleteCache(cacheKey);

    return {
      message: 'Xác thực bác sĩ thành công!',
    };
  }

  async rejectDoctor(userId: string, reason: string) {
    const pendingDoctor = await this.pendingDoctorModel.findOne({ userId });
    if (!pendingDoctor) {
      throw new NotFoundException('Đơn đăng ký không tồn tại hoặc đã được xử lý.');
    }

    // Cập nhật trạng thái và lý do từ chối
    await this.pendingDoctorModel.findOneAndUpdate(
      { userId },
      {
        status: PendingDoctorStatus.REJECTED,
        denyReason: reason
      }
    );

    // Xóa cache liên quan
    const cacheKey = 'pending_doctors';
    await this.cacheService.deleteCache(cacheKey);

    console.log(`Từ chối bác sĩ ${userId} với lý do: ${reason}`);

    return {
      message: 'Từ chối đơn đăng ký thành công!',
      reason,
    };
  }

  async getDoctorHomeVisit(specialtyId: string) {
    console.log("specialtyId input: ", specialtyId);

    // Kiểm tra doctor có home service
    const doctorWithHomeService = await this.DoctorModel.findOne({ hasHomeService: true });
    console.log("Doctor có home service:");
    console.log("- specialty value:", doctorWithHomeService.specialty);
    console.log("- specialty type:", typeof doctorWithHomeService.specialty);
    console.log("- specialty toString:", doctorWithHomeService.specialty.toString());

    // Thử query bằng string
    const doctorsByString = await this.DoctorModel.find({
      specialty: specialtyId,  // Dùng string trực tiếp
      hasHomeService: true
    });
    console.log("Query bằng string:", doctorsByString.length);

    // Thử query bằng ObjectId
    const doctorsByObjectId = await this.DoctorModel.find({
      specialty: new Types.ObjectId(specialtyId),
      hasHomeService: true
    });
    console.log("Query bằng ObjectId:", doctorsByObjectId.length);

    // Thử so sánh trực tiếp
    const allDoctors = await this.DoctorModel.find({ hasHomeService: true });
    const matched = allDoctors.filter(doc => {
      const specId = doc.specialty.toString();
      console.log(`Comparing: ${specId} === ${specialtyId} => ${specId === specialtyId}`);
      return specId === specialtyId;
    });
    console.log("Matched doctors:", matched.length);

    return matched;
  }
}

