import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationController } from '../controller/notification.controller';
import { NotificationService } from '../services/notification.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATION_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3021,
        },
      },
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}

