import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserDto } from '../core/dto/users.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../core/schema/user.schema';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, lastValueFrom, of, timeout } from 'rxjs';
import { UpdateFcmDto } from '../core/dto/update-fcm.dto';
import { CreateUserDto } from '../core/dto/createUser.dto';
import * as bcrypt from 'bcrypt';
import * as admin from 'firebase-admin';
import { CloudinaryService } from 'libs/cloudinary/src/service/cloudinary.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name, 'userConnection') private UserModel: Model<User>,
    @Inject('DOCTOR_CLIENT') private readonly doctorClient: ClientProxy,
    @Inject('SPECIALTY_CLIENT') private readonly specialtyClient: ClientProxy,
    private cloudinaryService: CloudinaryService

  ) { }
  async updateFcmToken(userId: string, updateFcmDto: UpdateFcmDto) {
    console.log(updateFcmDto.token);
    if (updateFcmDto.userModel == 'User') {
      return this.UserModel.findByIdAndUpdate(
        userId,
        { fcmToken: updateFcmDto.token },
        { new: true }
      );
    } else if (updateFcmDto.userModel == 'Doctor') {
      // return this.DoctorModel.findByIdAndUpdate(
      //   userId,
      //   { fcmToken: updateFcmDto.token },
      //   { new: true }
      // );
      try {
        const response = await lastValueFrom(
          this.doctorClient.send('doctor.update-fcm-token', { id: userId, token: updateFcmDto.token }).pipe(timeout(3000))
        );
        return response;
      } catch (e) {
        console.warn('Doctor service timeout hoặc lỗi, trả về rongyang');
        return { fcmToken: updateFcmDto.token };
      }
    }

  }

  async getUser() {
    return await this.UserModel.find();
  }

  async getAllUsers() {
    const users = await this.UserModel.find({ isDeleted: false });

    try {
      const doctors = await lastValueFrom(
        this.doctorClient.send('doctor.get-all', {}).pipe(timeout(3000))
      );
      return { users, doctors };
    } catch (e) {
      console.warn('Doctor service timeout hoặc lỗi, trả về rỗng');
      return { users, doctors: [] }; // fallback
    }
  }


  async getUserByID(id: string) {
    console.log('Received user ID:', id, typeof id);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const user = await this.UserModel.findById(id);
    if (user) {
      return user;
    }

    try {
      const doctor = await lastValueFrom(
        this.doctorClient.send('doctor.get-by-id', id).pipe(timeout(3000))
      );
      if (doctor) {
        return doctor;
      }
    } catch (e) {
      console.error('Doctor service unavailable:', e.message);
    }
    throw new BadRequestException('User not found');
  }

  async getSoftDeletedUsers() {
    return this.UserModel.find({ isDeleted: true })
      .select('-password -__v')
      .lean();
  }

  async signup(userDto: CreateUserDto) {
    return this.UserModel.create(userDto);
  }

  async updatePassword(email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const updated = await this.UserModel.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );
    if (!updated) {
      try {
        const doctor = await lastValueFrom(
          this.doctorClient.send('doctor.update-password', { email, password }).pipe(timeout(3000))
        );
        return doctor;
      } catch (e) {
        throw new UnauthorizedException('Không tìm thấy người dùng');
      }
    }
    return updated;
  }

  async notify(userId: string, message: string) {
    try {
      var user = await this.UserModel.findById(userId);
      if (!user) {
        user = await lastValueFrom(this.doctorClient.send('doctor.get-by-id', userId).pipe(timeout(3000)));
      }
      if (user?.fcmToken) {
        await admin.messaging().send({
          token: user.fcmToken,
          notification: {
            title: 'Thông báo lịch hẹn mới',
            body: message,
          },
        });
        console.log(`Đã gửi thông báo đến người dùng ${userId}`);
      } else {
        console.warn(`Người dùng ${userId} không có fcmToken`);
      }
    } catch (error) {
      console.error(`Lỗi khi gửi thông báo đến người dùng ${userId}:`, error);
    }
  }


  // Đăng ký làm bác sĩ (Lưu vào bảng chờ phê duyệt)
  async applyForDoctor(userId: string, applyData: any) {
    // Kiểm tra người dùng tồn tại
    const user = await this.UserModel.findById(userId);
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');

    // Kiểm tra nếu đã đăng ký trước đó
    const existing = await lastValueFrom(
      this.doctorClient.send('doctor.get-by-user-id', userId).pipe(
        timeout(3000),
        catchError(() => of(null)) // Trả về null nếu lỗi
      )
    );

    if (existing) {
      throw new BadRequestException('Bạn đã gửi yêu cầu trở thành bác sĩ trước đó.');
    } else {

      // Danh sách các trường hợp lệ từ form data
      const allowedFields = [
        'CCCD',
        'certificates',
        'experience',
        'license',
        'specialty',
        'faceUrl',
        'avatarURL',
        'licenseUrl',
        'frontCccdUrl',
        'backCccdUrl',
        'address',
      ];

      // Lọc dữ liệu hợp lệ
      const filteredApplyData = {};
      Object.keys(applyData).forEach((key) => {
        if (allowedFields.includes(key)) {
          filteredApplyData[key] = applyData[key];
        }
      });

      filteredApplyData['email'] = user.email;
      filteredApplyData['phone'] = user.phone;
      filteredApplyData['name'] = user.name;

      if (filteredApplyData['specialty']) {
        const specialtyExists = await lastValueFrom(
          this.specialtyClient.send('specialty.get-by-id', filteredApplyData['specialty']).pipe(
            timeout(3000)
          )
        );
        if (!specialtyExists) {
          throw new BadRequestException('Chuyên khoa không tìm thấy.');
        }
      }

      if (applyData.faceUrl) {
        const uploadResult = await this.cloudinaryService.uploadFile(applyData.faceUrl, `PendingDoctors/${userId}/Face`);
        filteredApplyData['faceUrl'] = uploadResult.secure_url;
      }

      if (applyData.avatarURL) {
        const uploadResult = await this.cloudinaryService.uploadFile(applyData.avatarURL, `PendingDoctors/${userId}/Avatar`);
        filteredApplyData['avatarURL'] = uploadResult.secure_url;
      }

      if (applyData.licenseUrl) {
        const uploadResult = await this.cloudinaryService.uploadFile(applyData.licenseUrl, `PendingDoctors/${userId}/License`);
        filteredApplyData['licenseUrl'] = uploadResult.secure_url;
      }

      if (applyData.frontCccdUrl) {
        const uploadResult = await this.cloudinaryService.uploadFile(applyData.frontCccdUrl, `PendingDoctors/${userId}/Info`);
        filteredApplyData['frontCccdUrl'] = uploadResult.secure_url;
      }

      if (applyData.backCccdUrl) {
        const uploadResult = await this.cloudinaryService.uploadFile(applyData.backCccdUrl, `PendingDoctors/${userId}/Info`);
        filteredApplyData['backCccdUrl'] = uploadResult.secure_url;
      }

      // const pendingDoctor = new this.pendingDoctorModel({
      //   userId,
      //   ...filteredApplyData,
      // });

      const pendingDoctor = await lastValueFrom(
        this.doctorClient.send('doctor.create-pending-doctor', {
          userId,
          ...filteredApplyData
        }).pipe(
          timeout(5000),
          catchError(err => {
            console.error('Error calling doctor service:', err);
            throw new BadRequestException('Không thể kết nối với dịch vụ bác sĩ');
          })
        )
      );

      if (!pendingDoctor) {
        throw new BadRequestException('Đăng ký thất bại!');
      }

      return {
        message: 'Đăng ký bác sĩ thành công!'
      };
    }
  }
}
