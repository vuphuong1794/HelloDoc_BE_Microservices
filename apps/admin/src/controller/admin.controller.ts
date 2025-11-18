import {
    Body,
    Controller,
    Param,
    Get,
    Post,
    Put,
    UseGuards,
    Patch,
    Delete,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { Express } from 'express';
import { MessagePattern } from '@nestjs/microservices';
import { AdminService } from '../service/admin.service';
import { SignupDto } from '../core/dto/signup.dto';
import { JwtAuthGuard } from 'libs/Guard/jwt-auth.guard';
import { AdminGuard } from 'libs/Guard/AdminGuard.guard';

@Controller()
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        // private jwtService: JwtService,
    ) { }

    // @MessagePattern('admin.doctors')
    // async getDoctors() {
    //     return this.adminService.getDoctors();
    // }

    // @MessagePattern('admin.postadmin')
    // async postAdmin(@Body() signUpData: SignupDto) {
    //     return this.adminService.postAdmin(signUpData);
    // }

    @UseInterceptors(FileInterceptor('avatarURL'))
    @Put('updateUser/:id')
    async updateUser(
        @Param('id') id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() updateUserdata: any,
    ) {
        console.log("vô được")

        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID không hợp lệ');
        }
        console.log('Uploaded files:', file);

        if (file) {
            updateUserdata.avatarURL = file;
            console.log("da tai file vao bien");
        }

        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID không hợp lệ');
        }
        return this.adminService.updateUser(id, updateUserdata);
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

    // @Delete('delete-user/:id')
    // //@UseGuards(JwtAuthGuard, AdminGuard)
    // async deleteUser(@Param('id') id: string) {
    //     return this.adminService.deleteUser(id);
    // }

    // @Delete('delete-doctor/:id')
    // @UseGuards(JwtAuthGuard, AdminGuard)
    // async deleteDoctor(@Param('id') id: string) {
    //     return this.adminService.deleteDoctor(id);
    // }


}
