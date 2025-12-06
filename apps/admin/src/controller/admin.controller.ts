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
// import { JwtService } from '@nestjs/jwt';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { Express } from 'express';
import { MessagePattern, Payload } from '@nestjs/microservices';
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

    @MessagePattern("admin.createAdmin")
    async createAdmin(@Payload() signUpData: SignupDto) {
        return this.adminService.postAdmin(signUpData);
    }

    @MessagePattern('admin.getUsers')
    async getUsers() {
        return this.adminService.getUsers();
    }

    @MessagePattern('admin.doctors')
    async getDoctors() {
        return this.adminService.getDoctors();
    }

    @MessagePattern('admin.get-all')
    async getAllUsers() {
        return this.adminService.getAdmins();
    }

    @MessagePattern('admin.updateUser')
    async updateUser(@Payload() payload: any) {
        const { id, data } = payload;
        return this.adminService.updateUser(id, data);
    }

    // @MessagePattern('admin.deleteUser')
    // @UseGuards(JwtAuthGuard, AdminGuard)
    // async deleteUser(@Param('id') id: string) {
    //     return this.adminService.deleteUser(id);
    // }


    // @MessagePattern('admin.deleteDoctor')
    // @UseGuards(JwtAuthGuard, AdminGuard)
    // async deleteDoctor(@Param('id') id: string) {
    //     return this.adminService.deleteDoctor(id);
    // }


}
