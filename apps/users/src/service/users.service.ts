import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserDto } from '../core/dto/users.dto';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { User } from '../core/schema/user.schema';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { catchError, last, lastValueFrom, of, timeout } from 'rxjs';
import { UpdateFcmDto } from '../core/dto/update-fcm.dto';
import { CreateUserDto } from '../core/dto/createUser.dto';
import * as bcrypt from 'bcrypt';
import { updateUserDto } from '../core/dto/updateUser.dto';
import * as admin from 'firebase-admin';
import { MediaUrlHelper } from 'libs/media-url.helper';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name, 'userConnection') private UserModel: Model<User>,
    @Inject('DOCTOR_CLIENT') private readonly doctorClient: ClientProxy,
    @Inject('SPECIALTY_CLIENT') private readonly specialtyClient: ClientProxy,
    @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,
    @Inject('ADMIN_CLIENT') private readonly adminClient: ClientProxy,
    private readonly mediaUrlHelper: MediaUrlHelper,
  ) {}

  async updateFcmToken(userId: string, updateFcmDto: UpdateFcmDto) {
    if (updateFcmDto.userModel == 'User') {
      return this.UserModel.findByIdAndUpdate(
        userId,
        { fcmToken: updateFcmDto.token },
        { new: true },
      );
    } else if (updateFcmDto.userModel == 'Doctor') {
      try {
        const response = await lastValueFrom(
          this.doctorClient
            .send('doctor.update-fcm-token', {
              id: userId,
              token: updateFcmDto.token,
            })
            .pipe(timeout(3000)),
        );
        return response;
      } catch (e) {
        console.warn('Doctor service timeout hoặc lỗi:', e.message);
        return { fcmToken: updateFcmDto.token };
      }
    }
  }

  async getUser() {
    return await this.UserModel.find();
  }

  async getAllUsers() {
    const users = await this.UserModel.find({ isDeleted: false }).lean();

    // Các logic còn lại giữ nguyên, mediaUrlHelper sẽ hoạt động tốt hơn với plain object
    const usersWithFullURLs = this.mediaUrlHelper.constructArrayUrls(users, [
      'avatarURL',
    ]);

    try {
      const doctors = await lastValueFrom(
        this.doctorClient.send('doctor.get-all', {}).pipe(timeout(3000)),
      );
      const admins = await lastValueFrom(
        this.adminClient.send('admin.get-all', {}).pipe(timeout(3000)),
      );

      // Construct full avatar URLs for doctors and admins
      const doctorsWithFullURLs = this.mediaUrlHelper.constructArrayUrls(
        doctors,
        ['avatarURL'],
      );
      const adminsWithFullURLs = this.mediaUrlHelper.constructArrayUrls(
        admins,
        ['avatarURL'],
      );

      //Nối 3 danh sách lại với nhau
      const allUsers = [
        ...usersWithFullURLs,
        ...doctorsWithFullURLs,
        ...adminsWithFullURLs,
      ];
      return allUsers;
    } catch (e) {
      console.warn('Doctor service timeout hoặc lỗi, trả về rỗng');
      return [...usersWithFullURLs]; // fallback
    }
  }

  async getAllWithFilter(limit: number, skip: number, searchText?: string) {
    let filter: any = { isDeleted: false };
    if (searchText && searchText.trim() !== '') {
      filter.$or = [
        { name: { $regex: searchText, $options: 'i' } },
        { email: { $regex: searchText, $options: 'i' } },
        { phone: { $regex: searchText, $options: 'i' } },
      ];
    }

    const total = await this.UserModel.countDocuments(filter);

    const users = await this.UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { data: users, total };
  }

  async getUserByID(id: string) {
    //console.log('Received user ID:', id, typeof id);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const user = await this.UserModel.findById(id);
    if (user) {
      //console.log('Ket qua tra ve tu user service' + user);
      // Construct full avatar URL from relative path
      return this.mediaUrlHelper.constructObjectUrls(user.toObject(), [
        'avatarURL',
      ]);
    }

    try {
      const doctor = await lastValueFrom(
        this.doctorClient.send('doctor.get-by-id', id).pipe(timeout(3000)),
      );
      if (doctor) {
        //console.log('Ket qua tra ve tu doctor service' + doctor);
        // Construct full avatar URL for doctor too
        return this.mediaUrlHelper.constructObjectUrls(doctor, ['avatarURL']);
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
      { new: true },
    );
    if (!updated) {
      try {
        const doctor = await lastValueFrom(
          this.doctorClient
            .send('doctor.update-password', { email, password })
            .pipe(timeout(3000)),
        );
        if (doctor) return doctor;
      } catch (e) {
        console.warn('Doctor service update password failed:', e.message);
      }

      try {
        const admin = await lastValueFrom(
          this.adminClient
            .send('admin.updatePassword', { email, password })
            .pipe(timeout(3000)),
        );
        if (admin) return admin;
      } catch (e) {
        console.warn('Admin service update password failed:', e.message);
      }

      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    return updated;
  }

  async notify(userId: string, message: string) {
    try {
      var user = await this.UserModel.findById(userId);
      if (!user) {
        user = await lastValueFrom(
          this.doctorClient
            .send('doctor.get-by-id', userId)
            .pipe(timeout(3000)),
        );
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
  async applyForDoctor(id: string, applyData: any) {
    console.log('applyData:', applyData);
    console.log('faceUrl:', applyData.faceUrl);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('User ID không hợp lệ.');
    }

    const userId = new Types.ObjectId(id);

    // Kiểm tra người dùng tồn tại
    const user = await this.UserModel.findById(userId);
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');

    // Kiểm tra nếu đã đăng ký trước đó
    const existing = await lastValueFrom(
      this.doctorClient.send('doctor.get-pedingDoctor-by-id', userId).pipe(
        timeout(3000),
        catchError((error) => of(null)),
      ),
    );

    if (existing) {
      throw new BadRequestException(
        'Bạn đã gửi yêu cầu trở thành bác sĩ trước đó.',
      );
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
        const specialtyId = filteredApplyData['specialty'];
        if (!Types.ObjectId.isValid(specialtyId)) {
          throw new BadRequestException('Chuyên khoa không hợp lệ.');
        }

        const specialtyIdObj = new Types.ObjectId(specialtyId);
        const specialtyExists = await lastValueFrom(
          this.specialtyClient
            .send('specialty.get-by-id', specialtyIdObj)
            .pipe(timeout(3000)),
        );
        if (!specialtyExists) {
          throw new BadRequestException('Chuyên khoa không tìm thấy.');
        }
      }

      if (applyData.faceUrl) {
        filteredApplyData['faceUrl'] = applyData.faceUrl;
      }

      if (applyData.avatarURL) {
        filteredApplyData['avatarURL'] = applyData.avatarURL;
      }

      if (applyData.licenseUrl) {
        filteredApplyData['licenseUrl'] = applyData.licenseUrl;
      }

      if (applyData.frontCccdUrl) {
        filteredApplyData['frontCccdUrl'] = applyData.frontCccdUrl;
      }

      if (applyData.backCccdUrl) {
        filteredApplyData['backCccdUrl'] = applyData.backCccdUrl;
      }

      console.log('filteredApplyData:', filteredApplyData);
      const pendingDoctor = await lastValueFrom(
        this.doctorClient
          .send('doctor.create-pending-doctor', {
            userId,
            ...filteredApplyData,
          })
          .pipe(
            timeout(60000),
            catchError((err) => {
              console.error('Error calling doctor service:', err);
              throw new BadRequestException(
                'Không thể kết nối với dịch vụ bác sĩ',
              );
            }),
          ),
      );

      if (!pendingDoctor) {
        throw new BadRequestException('Đăng ký thất bại!');
      }

      return {
        message: 'Đăng ký bác sĩ thành công!',
      };
    }
  }

  async delete(id: string) {
    // Check if the user exists in either UserModel or DoctorModel
    let user =
      (await this.UserModel.findById(id)) ||
      (await lastValueFrom(
        this.doctorClient.send('doctor.get-by-id', id).pipe(timeout(3000)),
      ));

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (user.isDeleted) {
      return { message: 'User already deleted' };
    }

    // Soft delete the user
    await this.UserModel.findByIdAndUpdate(id, { isDeleted: true });
    await this.doctorClient.send('update', { id, isDeleted: true });

    return { message: 'User soft-deleted successfully' };
  }

  async reactivateUser(id: string) {
    // Check if the user exists in either UserModel or DoctorModel
    let user =
      (await this.UserModel.findById(id)) ||
      (await lastValueFrom(
        this.doctorClient.send('doctor.get-by-id', id).pipe(timeout(3000)),
      ));

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (!user.isDeleted) {
      return { message: 'Người dùng vẫn đang hoạt động' };
    }

    // Soft delete the user
    await this.UserModel.findByIdAndUpdate(id, { isDeleted: false });
    await this.doctorClient.send('update', { id, isDeleted: false });

    return { message: 'User reactivated successfully' };
  }

  async create(userDto: any) {
    return this.UserModel.create(userDto);
  }

  async updateProfile(id: string, updateData: any) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    const objectId = new Types.ObjectId(id);

    let isDoctor = false;
    let accountExists: any = null;

    // --- BƯỚC 1: TÌM XEM TÀI KHOẢN NÀY LÀ AI ---
    // 1.1 Tìm trong bảng User trước
    accountExists = await this.UserModel.findById(objectId);

    // 1.2 Nếu không có, hỏi Doctor Service xem có Bác sĩ này không
    if (!accountExists) {
      try {
        accountExists = await lastValueFrom(
          this.doctorClient.send('doctor.get-by-id', id).pipe(timeout(3000)),
        );
        if (accountExists && accountExists._id) {
          isDoctor = true; // Đánh dấu đây là Bác sĩ!
        }
      } catch (error) {
        // Kệ lỗi, sẽ bị chặn ở bước dưới
      }
    }

    // 1.3 CHỐT CHẶN: Không có ở cả 2 nơi thì văng lỗi ngay
    if (!accountExists || !accountExists._id) {
      throw new RpcException(
        new NotFoundException('Không tìm thấy tài khoản trong hệ thống'),
      );
    }

    // --- BƯỚC 2: XỬ LÝ DỮ LIỆU CHUNG (Dùng cho cả User & Doctor) ---
    const updateFields: Partial<updateUserDto> = {};

    // Check if avatarURL is already provided (uploaded by admin service)
    if (updateData.avatarURL) {
      updateFields.avatarURL = updateData.avatarURL;
      console.log('Using pre-uploaded avatar URL:', updateFields.avatarURL);
    } else if (updateData.avatar) {
      try {
        const uploadResult = await this.mediaClient
          .send('media.upload', {
            buffer: updateData.avatar.buffer,
            filename: updateData.avatar.originalname,
            mimetype: updateData.avatar.mimetype,
            folder: `user/${id}/avatar`,
          })
          .toPromise();
        // Save relative path to database instead of full URL
        updateFields.avatarURL = uploadResult.relative_path;
        console.log(
          'Avatar uploaded successfully. Relative path:',
          uploadResult.relative_path,
        );
      } catch (error) {
        console.error('Media upload error:', error);
        throw new BadRequestException('Lỗi khi tải avatar lên Media');
      }
    }
    // BỔ SUNG Ở ĐÂY: Nếu không có file mới, nhưng client có gửi string avatarURL
    else if (updateData.avatarURL) {
      updateFields.avatarURL = updateData.avatarURL;
    }

    // 2.2 Ánh xạ dữ liệu cơ bản
    if (updateData.email) updateFields.email = updateData.email;
    if (updateData.name) updateFields.name = updateData.name;
    if (updateData.phone) updateFields.phone = updateData.phone;
    if (updateData.address) updateFields.address = updateData.address;
    if (updateData.role) updateFields.role = updateData.role;

    // 2.3 Băm mật khẩu (nếu có)
    if (
      updateData.password &&
      typeof updateData.password === 'string' &&
      updateData.password.trim() !== ''
    ) {
      updateFields.password = await bcrypt.hash(updateData.password, 10);
    }

    if (Object.keys(updateFields).length === 0) {
      return { message: 'Không có thông tin nào thay đổi' };
    }

    console.log('[USER-SERVICE] Dữ liệu đã xử lý xong chuẩn bị lưu:', {
      id,
      isDoctor,
      updateFields,
    });

    // --- BƯỚC 3: LƯU VÀO DATABASE TƯƠNG ỨNG ---
    if (!isDoctor) {
      // Lưu thẳng vào bảng User
      const updatedUser = await this.UserModel.findByIdAndUpdate(
        objectId,
        { $set: updateFields },
        { new: true },
      );
      if (!updatedUser)
        throw new RpcException(new BadRequestException('Lỗi cập nhật User'));

      return {
        message: 'Cập nhật hồ sơ Bệnh nhân thành công',
        user: updatedUser,
      };
    } else {
      // Lưu vào bảng Doctor (gửi data đã băm/chuẩn hóa sang Doctor Service)
      const updatedDoctor = await lastValueFrom(
        this.doctorClient
          .send('doctor.update', { id, data: updateFields })
          .pipe(
            timeout(5000),
            catchError((err) => {
              throw err;
            }),
          ),
      );
      return {
        message: 'Cập nhật hồ sơ Bác sĩ thành công',
        user: updatedDoctor,
      };
    }
  }

  async hardDelete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    await this.UserModel.findByIdAndDelete(id);
    return { message: 'User hard-deleted successfully' };
  }
}
