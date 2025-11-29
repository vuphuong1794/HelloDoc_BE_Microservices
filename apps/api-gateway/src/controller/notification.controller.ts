import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { CreateNotificationDto } from '../core/dto/notification.dto';
import { UpdateNotificationDto } from '../core/dto/update-notification.dto';
import { SendBulkNotificationDto } from '../core/dto/send-bulk-notification.dto';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('create')
  async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return await this.notificationService.createNotification(createNotificationDto);
  }

  @Get('get-by-user-id/:userId')
  async getNotificationsByUser(@Param('userId') userId: string) {
    return await this.notificationService.getNotificationsByUser(userId);
  }

  @Get('get-by-user-id/:userId/unread')
  async getUnreadNotifications(@Param('userId') userId: string) {
    return await this.notificationService.getUnreadNotifications(userId);
  }

  @Get('get-by-user-id/:userId/unread-count')
  async getUnreadCount(@Param('userId') userId: string) {
    return await this.notificationService.getUnreadCount(userId);
  }

  @Patch(':id/mark-as-read')
  async markAsRead(@Param('id') id: string) {
    return await this.notificationService.markAsRead(id);
  }

  @Patch('get-by-user-id/:userId/mark-all-as-read')
  async markAllAsRead(@Param('userId') userId: string) {
    return await this.notificationService.markAllAsRead(userId);
  }

  @Delete(':id/delete')
  async deleteNotification(@Param('id') id: string) {
    return await this.notificationService.deleteNotification(id);
  }

  @Get(':id')
  async getNotificationById(@Param('id') id: string) {
    return await this.notificationService.getNotificationById(id);
  }

  @Put(':id')
  async updateNotification(
    @Param('id') id: string,
    @Body() updateDto: UpdateNotificationDto,
  ) {
    return await this.notificationService.updateNotification(id, updateDto);
  }

  @Post('bulk')
  async sendBulkNotifications(
    @Body() sendBulkNotificationDto: SendBulkNotificationDto,
  ) {
    return await this.notificationService.sendBulkNotifications(sendBulkNotificationDto);
  }
}

