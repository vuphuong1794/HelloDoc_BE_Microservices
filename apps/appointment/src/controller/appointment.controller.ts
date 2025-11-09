import { Controller, Get } from '@nestjs/common';
import { AppointmentService } from '../service/appointment.service';

@Controller()
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }


}
