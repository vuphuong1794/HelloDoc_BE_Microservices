import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateReportDto } from '../core/dto/report/create-report.dto';
import { UpdateReportStatusDto, UpdateReportResponseDto } from '../core/dto/report/update-report.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ReportService {
  constructor(
    @Inject('REPORT_CLIENT') private readonly reportClient: ClientProxy,
  ) {}

  async create(createReportDto: CreateReportDto) {
    return firstValueFrom(
      this.reportClient.send('create_report', createReportDto)
    );
  }

  async getAll() {
    return firstValueFrom(
      this.reportClient.send('get_all_reports', {})
    );
  }

  async updateStatus(id: string, status: 'opened' | 'closed') {
    return firstValueFrom(
      this.reportClient.send('update_report_status', { id, status })
    );
  }

  async updateResponse(id: string, responseContent: string, responseTime: string) {
    return firstValueFrom(
      this.reportClient.send('update_report_response', { id, responseContent, responseTime })
    );
  }

  async delete(id: string) {
    return firstValueFrom(
      this.reportClient.send('delete_report', id)
    );
  }
}
