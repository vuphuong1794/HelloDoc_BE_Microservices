import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AdminService {
    constructor(
        @Inject('ADMIN_CLIENT') private adminClient: ClientProxy,
) { }

    updateUser(id: string, data: any) {
        return this.adminClient.send('admin.updateUser', { id, data });
    }

}