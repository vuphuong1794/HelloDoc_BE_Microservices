import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

@Injectable()
export class DoctorService {
    constructor(
        @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,

    ) { }
    async getAllDoctor() {
        return this.doctorClient.send('doctor.get-all', {})
    }

    async getDoctorById(id: string) {
        return this.doctorClient.send('doctor.get-by-id', id)
    }

    async applyForDoctor(userId: string, applyData: any) {
        return this.doctorClient.send('doctor.apply-for-doctor', { userId, applyData })
    }

    async getPendingDoctor() {
        return this.doctorClient.send('doctor.get-pedingDoctor', {})
    }

    async getPendingDoctorById(id: string) {
        return this.doctorClient.send('doctor.get-pedingDoctor-by-id', id)
    }

    async getAvailableWorkingTime(id: string) {
        return this.doctorClient.send('doctor.getAvailableWorkingTime', id)
    }
}