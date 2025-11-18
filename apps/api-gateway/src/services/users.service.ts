import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class UsersService {
  constructor(@Inject('USERS_CLIENT') private usersClient: ClientProxy) { }

  findAll() {
    return this.usersClient.send('user.users', {});
  }

  getAllUsers() {
    return this.usersClient.send('user.getallusers', {});
  }

  getUserById(id: string) {
    return this.usersClient.send('user.getuserbyid', id);
  }

  updateUser(id: string, data: any) {
    return this.usersClient.send('user.update', { id, data });
  }
}
