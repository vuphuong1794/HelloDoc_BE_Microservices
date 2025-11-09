import { Module } from '@nestjs/common';
import { AppointmentService } from '../service/appointment.service';
import { AppointmentController } from '../controller/appointment.controller';

@Module({
  imports: [],
  controllers: [AppointmentController],
  providers: [AppointmentService],
})
export class AppointmentModule { }
