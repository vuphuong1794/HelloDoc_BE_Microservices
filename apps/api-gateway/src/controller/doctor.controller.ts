import { Body, Controller, Get, Param, Patch, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { DoctorService } from '../services/doctor.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('doctor')
export class DoctorController {
    constructor(private readonly doctorService: DoctorService) { }

    //trong microservices sử dụng message và event
    @Get('get-all')
    findAll() {
        return this.doctorService.getAllDoctor();
    }

    @Get('get-by-id/:id')
    getDoctorById(@Param('id') id: string) {
        return this.doctorService.getDoctorById(id);
    }

    @Patch('apply-for-doctor/:id')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'licenseUrl', maxCount: 1 },
            { name: 'faceUrl', maxCount: 1 },
            { name: 'avatarURL', maxCount: 1 },
            { name: 'frontCccdUrl', maxCount: 1 },
            { name: 'backCccdUrl', maxCount: 1 },
        ])
    )
    applyForDoctor(@Param('id') userId: string,
        @UploadedFiles() files: {
            licenseUrl?: Express.Multer.File[],
            faceUrl?: Express.Multer.File[],
            avatarURL?: Express.Multer.File[],
            frontCccdUrl?: Express.Multer.File[],
            backCccdUrl?: Express.Multer.File[]
        },
        @Body() formData: any,) {
        const doctorData = { ...formData };

        if (files?.licenseUrl?.[0]) {
            doctorData.licenseUrl = files.licenseUrl[0];
        }

        if (files?.faceUrl?.[0]) {
            doctorData.faceUrl = files.faceUrl[0];
        }

        if (files?.avatarURL?.[0]) {
            doctorData.avatarURL = files.avatarURL[0];
        }

        if (files?.frontCccdUrl?.[0]) {
            doctorData.frontCccdUrl = files.frontCccdUrl[0];
        }

        if (files?.backCccdUrl?.[0]) {
            doctorData.backCccdUrl = files.backCccdUrl[0];
        }

        return this.doctorService.applyForDoctor(userId, doctorData);
    }

    @Get('get-pending-doctor')
    getPendingDoctor() {
        return this.doctorService.getPendingDoctor();
    }

    @Get('get-pendingDoctor-by-id/:id')
    getPendingDoctorById(@Param('id') id: string) {
        return this.doctorService.getPendingDoctorById(id);
    }

    @Get('getAvailableWorkingTime/:id')
    getAvailableWorkingTime(@Param('id') id: string) {
        return this.doctorService.getAvailableWorkingTime(id);
    }
}
