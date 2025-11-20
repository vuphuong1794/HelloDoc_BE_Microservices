import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AdminService {
    constructor(
        @Inject('ADMIN_CLIENT') private adminClient: ClientProxy,
) { }

    async getUsers() {
        return await this.adminClient.send('admin.getUsers', {});
    }

    async updateUser(id: string, data: any) {
        return this.adminClient.send('admin.updateUser', { id, data });
    }

    async getDoctors() {
        return await this.adminClient.send('admin.doctors', {});
    }

    async postAdmin(signUpData: any) {
        return this.adminClient.send
            ('admin.postadmin', signUpData);
    }

    async deleteUser(id: string) {
        return this.adminClient.send('admin.deleteUser', id);
    }

    async deleteDoctor(id: string) {
        return this.adminClient.send('admin.deleteDoctor', id);
    }

}