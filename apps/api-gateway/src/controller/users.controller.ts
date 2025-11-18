import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { Payload } from '@nestjs/microservices';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  //trong microservices sử dụng message và event
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('getallusers')
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('getuserbyid/:id')
  getUserByID(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Put('updateUser/:id')
  updateUser(@Param('id') id: string, @Body() data: any) {
    return this.usersService.updateUser(id, data);
  }

}
