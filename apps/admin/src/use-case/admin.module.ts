import { Module } from '@nestjs/common';
import { AdminController } from '../controller/admin.controller';
import { AdminService } from '../service/admin.service';

@Module({
  imports: [],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule { }
