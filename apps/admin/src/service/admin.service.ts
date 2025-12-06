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

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(Admin.name, 'adminConnection') private AdminModel: Model<Admin>,
        @Inject('USERS_CLIENT') private usersClient: ClientProxy,
        @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
        @Inject('CLOUDINARY_CLIENT') private cloudinaryClient: ClientProxy,
        // private jwtService: JwtService,
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

    async updateUser(id: string, updateData: any) {
        // Validate ObjectId format
        if (!isValidObjectId(id)) {
            throw new BadRequestException('Invalid ID format');
        }

        const objectId = new Types.ObjectId(id);

        // Check if the user exists
        let user = await lastValueFrom(this.usersClient.send('user.getuserbyid', id).pipe(timeout(3000)));
        // var isUser = true;
        // if (!user) {
        //     isUser = false
        //     user = await lastValueFrom(
        //         this.doctorClient.send('doctor.get-by-id', id).pipe(timeout(3000)));
        //     if (!user) {
        //         throw new NotFoundException('User not found');
        //     }
        // }

        // Prepare the update object
        const updateFields: Partial<updateUserDto> = {};
        if (updateData.avatarURL) {
            try {
                //const uploadResult = await this.cloudinaryService.uploadFile(updateData.avatarURL, `Doctors/${id}/License`);
                const uploadResult = await this.cloudinaryClient
                    .send('cloudinary.upload', {
                        buffer: updateData.avatarURL.buffer, // Base64 string
                        filename: updateData.avatarURL.originalname,
                        mimetype: updateData.avatarURL.mimetype,
                        folder: `Doctors/${id}/License`,
                    })
                    .toPromise();
                updateFields.avatarURL = uploadResult.secure_url;
                console.log('Avatar da tai len:', updateData.avatarURL);
            } catch (error) {
                console.error('Lỗi Cloudinary:', error);
                throw new BadRequestException('Lỗi khi tải avatar lên Cloudinary');
            }
        }

        if (updateData.email) updateFields.email = updateData.email;
        if (updateData.name) updateFields.name = updateData.name;
        if (updateData.phone) updateFields.phone = updateData.phone;
        if (updateData.address) updateFields.address = updateData.address;

        // 🔥 Only hash password if it is provided. Do NOT attempt to compare plaintext vs hashed password.
        if (updateData.password && typeof updateData.password === 'string' && updateData.password.trim() !== '') {
            updateFields.password = await bcrypt.hash(updateData.password, 10);
        }

        let roleChanged = false;
        let newRole = user.role; // Keep the old role by default

        if (updateData.role && updateData.role !== user.role) {
            roleChanged = true;
            newRole = updateData.role;
        }
        // Log thông tin cập nhật
        console.log('Thông tin cập nhật nguoi dung:', {
            id,
            updatedData: updateFields
        });
        // If no fields have changed, return a message
        if (Object.keys(updateFields).length === 0 && !roleChanged) {
            return { message: 'No changes detected' };
        }

        // Determine which model to update based on the user's existence in the models
        if (user) {
            // Update the user in UserModel (send id string and changed fields)
            const updatedUser = await lastValueFrom(
                this.usersClient.send('user.update', { id, data: updateFields }).pipe(
                    timeout(3000),
                    catchError((err) => {
                        console.error("🔥 Lỗi thật từ user.update:", err);
                        throw err;
                    })
                )
            );


            if (!updatedUser) {
                throw new NotFoundException('Update failed, user not found in UserModel');
            }

            // Handle role change if any
            if (roleChanged) {
                await this.handleRoleUpdate(objectId, user.role, newRole, updatedUser);
            }

            return { message: 'User updated successfully in UserModel', user: updatedUser };
        } else {
            // Update the user in DoctorModel (send id string and changed fields)
            const updatedDoctor = await lastValueFrom(
                this.doctorClient.send('doctor.update', {
                    id,
                    data: updateFields,
                }).pipe(timeout(3000))
            );

            if (!updatedDoctor) {
                throw new NotFoundException('Update failed, user not found in DoctorModel');
            }

            // Handle role change if any
            if (roleChanged) {
                await this.handleRoleUpdate(objectId, user.role, newRole, updatedDoctor);
            }

            return { message: 'User updated successfully in DoctorModel', user: updatedDoctor };
        }
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


    async deleteDoctor(id: string) {
        return this.doctorClient.send('doctor.delete', id);
    }


}
