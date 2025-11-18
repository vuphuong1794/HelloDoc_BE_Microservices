import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { BookAppointmentDto } from "../core/dto/appointment.dto";
import { AppointmentService } from "../services/appointment.service";

@Controller('appointment')
export class AppointmentController {
    constructor(private readonly appointmentService: AppointmentService) { }

    @Post('book')
    async bookAppoinentment(@Body() bookData: BookAppointmentDto) {
        return await this.appointmentService.bookAppointment(bookData);
    }

    @Get('getAll')
    async getAllAppointments() {
        return await this.appointmentService.getAllAppointments();
    }

    @Get('doctor/:doctorID')
    async getDoctorAppointments(@Param('doctorID') doctorID: string) {
        return await this.appointmentService.getDoctorAppointments(doctorID);
    }


}