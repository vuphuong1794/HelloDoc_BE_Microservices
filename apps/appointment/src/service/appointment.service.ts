import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentService {
  getHello(): string {
    return 'Hello World!';
  }
}
