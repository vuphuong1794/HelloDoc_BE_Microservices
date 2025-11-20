import { Body, Controller, Get, UseGuards } from '@nestjs/common';
import { AppointmentService } from '../service/appointment.service';
import { JwtAuthGuard } from 'libs/Guard/jwt-auth.guard';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BookAppointmentDto } from '../core/dto/appointment.dto';

@Controller()
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

  //@UseGuards(JwtAuthGuard)
  @MessagePattern('appointment.book')
  async bookAppoinentment(@Body() bookData: BookAppointmentDto) {
    return await this.appointmentService.bookAppointment(bookData);
  }

  @MessagePattern('appointment.cancel')
  async cancelAppoinentment(id: string) {
    return await this.appointmentService.cancelAppointment(id);
  }

  @MessagePattern('appointment.getById')
  async getAppointmentsbyitsID(id: string) {
    return await this.appointmentService.getAppointmentsbyitsID(id);
  }

  @MessagePattern('appointment.confirm')
  async confirmAppoinentment(id: string) {
    return await this.appointmentService.confirmAppointmentDone(id);
  }

  @MessagePattern('appointment.getAll')
  async getAllAppointments() {
    return await this.appointmentService.getAllAppointments();
  }

  @MessagePattern('appointment.getByDoctorID')
  async getDoctorAppointments(doctorID: string) {
    return await this.appointmentService.getDoctorAppointments(doctorID);
  }

  @MessagePattern('appointment.getByPatientID')
  async getPatientAppointments(patientID: string) {
    return await this.appointmentService.getPatientAppointments(patientID);
  }

  @MessagePattern('appointment.getByStatus')
  async getAppointmentsByStatus(patientID: string, status: string) {
    return await this.appointmentService.getAppointmentsByStatus(patientID, status);
  }

  @MessagePattern('appointment.update')
  async updateAppointment(id: string, updateData: Partial<BookAppointmentDto>) {
    return await this.appointmentService.updateAppointment(id, updateData);
  }

  @MessagePattern('appointment.delete')
  async deleteAppointment(id: string) {
    return await this.appointmentService.deleteAppointment(id);
  }

  @MessagePattern('appointment.getDoctorBookAppointment')
  async getDoctorBookAppointment(@Payload() data: any) {
    return await this.appointmentService.getDoctorBookAppointment(data);
  }

  async clearDoctorAppointmentCache(doctorID: string) {
    return await this.appointmentService.clearDoctorAppointmentCache(doctorID);
  }

  // @MessagePattern('appointment.doctorStats')
  // async getDoctorStats(doctorID: string) {
  //   return await this.appointmentService.getDoctorStats(doctorID);
  // }
}
