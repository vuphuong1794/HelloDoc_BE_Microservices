import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { BookAppointmentDto } from "../core/dto/appointment.dto";

@Injectable()
export class AppointmentService {
    constructor(
        @Inject('APPOINTMENT_CLIENT') private appointmentClient: ClientProxy
    ) { }
    async bookAppointment(bookData: BookAppointmentDto) {
        return this.appointmentClient.send('appointment.book', bookData);
    }

    async getAllAppointments() {
        return this.appointmentClient.send('appointment.getAll', {});
    }

    async getDoctorAppointments(doctorID: string) {
        return this.appointmentClient.send('appointment.getByDoctorID', doctorID);
    }

    async getPatientAppointments(patientID: string) {
        return this.appointmentClient.send('appointment.getByPatientID', patientID);
    }

    async getAvailableWorkingTime(id: string) {
        return this.appointmentClient.send('appointment.getDoctorBookAppointment', id);
    }
}
