import {
    BadRequestException,
    Inject,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, isValidObjectId, Types } from 'mongoose';
// import { JwtService } from '@nestjs/jwt';

import { Admin } from '../core/schema/admin.schema';
import { ClientProxy } from '@nestjs/microservices';
import { SignupDto } from '../core/dto/signup.dto';
import { updateUserDto } from '../core/dto/updateUser.dto';
import { lastValueFrom, timeout, catchError } from 'rxjs';
import { MediaUrlHelper } from 'libs/media-url.helper';

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(Admin.name, 'adminConnection') private AdminModel: Model<Admin>,
        @Inject('USERS_CLIENT') private usersClient: ClientProxy,
        @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
        @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,
        private readonly mediaUrlHelper: MediaUrlHelper,
    ) { }

    async getUsers() {
        return await this.usersClient.send('user.getallusers', {});
    }

    async getDoctors() {
        return await this.doctorClient.send('doctor.get-all', {});
    }

    async getAdmins() {
        return await this.AdminModel.find();
    }

    async postAdmin(signUpData: SignupDto) {
        const { email, password, name, phone } = signUpData;

        const emailInUse = await this.AdminModel.findOne({ email });
        if (emailInUse) {
            throw new BadRequestException('Email already in use');
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        await this.AdminModel.create({
            email,
            password: hashedPassword,
            name,
            phone,
            isDeleted: false,
        });

        return { message: 'Admin created successfully' };
    }

    // TẠI ADMIN SERVICE
    async updateUser(id: string, updateData: any) {
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid ID format');
        }

        console.log(`\n===========================================`);
        console.log(`[ADMIN-GATEWAY] 🚀 Chuyển tiếp toàn bộ data cập nhật profile của ID: ${id} tới User Service`);
        console.log(`===========================================`);

        // KHÔNG CẦN TÌM KIẾM, KHÔNG CẦN RẼ NHÁNH DOCTOR.
        // Đẩy thẳng sang UserService xử lý tất cả.
        const result = await lastValueFrom(
            this.usersClient.send('user.update', { id, data: updateData }).pipe(
                timeout(5000), // Nên để 5s phòng trường hợp up ảnh tốn thời gian
                catchError((err) => {
                    console.error("🔥 Lỗi trả về từ User Service:", err);
                    throw err;
                })
            )
        );

        return result;
    }

    private async handleRoleUpdate(
        userId: Types.ObjectId,
        oldRole: string,
        newRole: string,
        userData: any,
    ) {
        const existingPassword = userData.password;

        // Xóa user khỏi collection cũ nếu cần
        if (oldRole === 'admin') {
            await this.AdminModel.findOneAndDelete({ userId });
        } else if (oldRole === 'doctor') {
            await this.doctorClient.send('doctor.delete', userId);
        } else {
            await this.usersClient.send('user.delete', userId);
        }
        // Thêm vào collection mới nếu role thay đổi
        if (newRole === 'admin') {
            await this.AdminModel.create({
                userId,
                name: userData.name,
                email: userData.email,
                phone: userData.phone, // Đảm bảo có phone
                password: existingPassword, // Đảm bảo có password
            });
            await this.usersClient.send('user.delete', userId);
        } else if (newRole === 'doctor') {
            await this.doctorClient.send('create', {
                userId,
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                password: existingPassword,
            });
            await this.usersClient.send('user.delete', userId);
        } else if (newRole === 'user') {
            // Xóa tài khoản khỏi AdminModel / DoctorModel
            await this.AdminModel.findOneAndDelete({ userId });
            await this.doctorClient.send('doctor.delete', userId);

            // Tạo lại tài khoản trong UserModel
            await this.usersClient.send('user.create', {
                _id: userId, // Đặt lại ID cũ
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                password: existingPassword,
                role: 'user', // Đảm bảo đúng role
            });
        }
    }

    // async generateAdminTokens(userId, email, name, role) {
    //     const accessToken = this.jwtService.sign(
    //         { userId, email, name, role },
    //         { expiresIn: '1d' },
    //     );
    //     return {
    //         accessToken,
    //     };
    // }

    async deleteUser(id: string) {
        return this.usersClient.send('user.delete', id);
    }

    async reactivateUser(id: string) {
        return this.usersClient.send('user.reactivate-user-account', id);
    }


    async deleteDoctor(id: string) {
        return this.doctorClient.send('doctor.delete', id);
    }

    async updatePassword(email: string, password: string) {
        const hashedPassword = await bcrypt.hash(password, 10);
        return await this.AdminModel.findOneAndUpdate(
            { email },
            { password: hashedPassword },
            { new: true }
        );
    }
}
