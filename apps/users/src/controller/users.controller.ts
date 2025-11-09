import { Body, Controller, Param } from '@nestjs/common';
import { UsersService } from '../service/users.service';
import { MessagePattern } from '@nestjs/microservices';
import { UpdateFcmDto } from '../core/dto/update-fcm.dto';
import { CreateUserDto } from '../core/dto/createUser.dto';

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

  @MessagePattern('user.userbyid')
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
}
