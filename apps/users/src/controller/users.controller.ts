import { Body, Controller, Param, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { UsersService } from '../service/users.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UpdateFcmDto } from '../core/dto/update-fcm.dto';
import { CreateUserDto } from '../core/dto/createUser.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @MessagePattern(':id/fcm-token')
  async updateFcmToken(@Param('id') id: string, @Body() updateFcmDto: UpdateFcmDto) {
    return this.usersService.updateFcmToken(id, updateFcmDto);
  }

  @MessagePattern('user.users')
  async getUser() {
    return this.usersService.getUser();
  }

  @MessagePattern('user.getallusers')
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @MessagePattern('user.getuserbyid')
  async getUserByID(id: string) {
    return this.usersService.getUserByID(id);
  }

  @MessagePattern('user.get-soft-deleted-users')
  async getSoftDeletedUsers() {
    return this.usersService.getSoftDeletedUsers();
  }

  @MessagePattern('user.signup')
  async createUser(@Body() userData: CreateUserDto) {
    return this.usersService.signup(userData);
  }

  @MessagePattern('user.updatePassword')
  async updatePassword(@Body() email: string, newPassword: string) {
    return this.usersService.updatePassword(email, newPassword);
  }

  @MessagePattern('user.notify')
  async notify(userId: string, message: string) {
    return this.usersService.notify(userId, message);
  }

  @MessagePattern('user.apply-for-doctor')
  async applyForDoctor(@Payload() data: { userId: string, applyData: any }) {
    const { userId, applyData } = data;

    const doctorData = { ...applyData };

    return this.usersService.applyForDoctor(userId, doctorData);
  }

  @MessagePattern('user.delete')
  async delete(id: string) {
    return this.usersService.delete(id);
  }

  @MessagePattern('user.create')
  async create(@Payload() data: any) {
    return this.usersService.create(data);
  }

  @MessagePattern('user.update')
  async update(@Payload ("id") id: string, @Payload ("data") data: any) {
    return this.usersService.updateUser(id, data);
  }

//   @MessagePattern('user.update')
//   async update(@Payload() updateData: {id: string, data: any}) {
//     const{id, data} = updateData;
//     return this.usersService.updateUser(id, data);
//   }
// }

}
