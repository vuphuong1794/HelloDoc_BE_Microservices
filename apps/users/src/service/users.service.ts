import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserDto } from '../core/dto/users.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../core/schema/user.schema';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import { UpdateFcmDto } from '../core/dto/update-fcm.dto';
import { CreateUserDto } from '../core/dto/createUser.dto';
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name, 'userConnection') private UserModel: Model<User>,
    @Inject('DOCTOR_CLIENT') private readonly doctorClient: ClientProxy,

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

 async updatePassword(userDto: CreateUserDto) {
  const { _id, password } = userDto;
  const hashedPassword = await bcrypt.hash(password, 10);
  return this.UserModel.findByIdAndUpdate(
    _id,
    { password: hashedPassword },
    { new: true }
  );  


}
