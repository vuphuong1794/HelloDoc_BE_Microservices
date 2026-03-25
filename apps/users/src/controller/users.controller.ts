import { Body, Controller, Param, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { UsersService } from '../service/users.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UpdateFcmDto } from '../core/dto/update-fcm.dto';
import { CreateUserDto } from '../core/dto/createUser.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @MessagePattern('user.updateFcmToken')
  async updateFcmToken(@Payload() data: any) {
    console.log('Updating FCM Token for user ID:', data.id, 'with data:', data);

    // Extract data properly
    const { id, token, userModel } = data;

    return this.usersService.updateFcmToken(id, { token, userModel });
  }

  @MessagePattern('user.users')
  async getUser() {
    return this.usersService.getUser();
  }

  @MessagePattern('user.getallusers')
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @MessagePattern('user.get-all-filtered')
  async getAllWithFilter(@Payload() data: { limit?: number; offset?: number; searchText?: string }) {
    const limit = data.limit ?? 10;
    const skip = data.offset ?? 0;
    const searchText = data.searchText;

    return this.usersService.getAllWithFilter(limit, skip, searchText);
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
  async updatePassword(@Payload() data: { email: string, password: string }) {
    return this.usersService.updatePassword(data.email, data.password);
  }

  @MessagePattern('user.notify')
  async notify(@Payload() data: { userID: string, message: string }) {
    console.log('📨 Nhận message userID:', data);

    return this.usersService.notify(data.userID, data.message);
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

  @MessagePattern('user.reactivate-user-account')
  async reactivateUser(id: string) {
    return this.usersService.reactivateUser(id);
  }

  @MessagePattern('user.create')
  async create(@Payload() data: any) {
    return this.usersService.create(data);
  }

  @MessagePattern('user.update')
  async update(@Payload() updateData: { id: string, data: any }) {
    console.log('Updating user with ID:', updateData.id, 'and data:', updateData.data);
    const { id, data } = updateData;
    return this.usersService.updateProfile(id, data);
  }

  @MessagePattern('user.hard-delete')
  async hardDelete(id: string) {
    return this.usersService.hardDelete(id);
  }

}