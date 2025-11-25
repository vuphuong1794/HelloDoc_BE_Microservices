import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReportService } from '../service/report.service';
import { CreateReportDto } from '../core/dto/create-report.dto';
import { UpdateReportStatusDto, UpdateReportResponseDto } from '../core/dto/update-report.dto';

@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @MessagePattern('create_report')
  async createReport(@Payload() data: CreateReportDto) {
    return this.reportService.createReport(data);
  }

  @MessagePattern('get_all_reports')
  async getAllReports() {
    return this.reportService.getAllReports();
  }

  @MessagePattern('update_report_status')
  async updateStatus(@Payload() data: { id: string; status: 'opened' | 'closed' }) {
    return this.reportService.updateStatus(data.id, data.status);
  }

  @MessagePattern('update_report_response')
  async updateResponse(@Payload() data: { id: string; responseContent: string; responseTime: string }) {
    return this.reportService.updateResponse(data.id, data.responseContent, data.responseTime);
  }

  @MessagePattern('delete_report')
  async deleteReport(@Payload() id: string) {
    return this.reportService.deleteReport(id);
  }
}
