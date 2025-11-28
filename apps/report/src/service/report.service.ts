import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Report, ReportDocument } from '../core/schema/report.schema';
import { CreateReportDto } from '../core/dto/create-report.dto';
import { UpdateReportStatusDto, UpdateReportResponseDto } from '../core/dto/update-report.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Report.name, 'reportConnection') private reportModel: Model<ReportDocument>,
    @Inject('USERS_CLIENT') private readonly usersClient: ClientProxy,
    @Inject('DOCTOR_CLIENT') private readonly doctorClient: ClientProxy,
  ) {}

  async createReport(data: CreateReportDto) {
    const report = await this.reportModel.create({
      reporter: data.reporter,
      reporterModel: data.reporterModel,
      content: data.content,
      type: data.type,
      reportedId: data.reportedId,
      postId: data.postId,
    });
    return report;
  }

  async getAllReports() {
    const reports = await this.reportModel
      .find()
      .sort({ createdAt: -1 })
      .lean();

    // Populate reporter data using ClientProxy
    const populatedReports = await Promise.all(
      reports.map(async (report) => {
        let reporterData = null;
        
        try {
          if (report.reporterModel === 'User') {
            reporterData = await firstValueFrom(
              this.usersClient.send('user.getuserbyid', report.reporter)
            );
          } else if (report.reporterModel === 'Doctor') {
            reporterData = await firstValueFrom(
              this.doctorClient.send('doctor.get-by-id', report.reporter)
            );
          }
        } catch (error) {
          console.error(`Error fetching reporter data: ${error.message}`);
        }

        return {
          ...report,
          reporter: reporterData || report.reporter,
        };
      })
    );

    return populatedReports;
  }

  async updateStatus(id: string, status: 'opened' | 'closed') {
    const report = await this.reportModel.findById(id);
    if (!report) throw new NotFoundException('Report not found');
    
    report.status = status;
    return report.save();
  }

  async updateResponse(id: string, responseContent: string, responseTime: string) {
    const report = await this.reportModel.findById(id);
    if (!report) throw new NotFoundException('Report not found');
    
    report.responseContent = responseContent;
    report.responseTime = responseTime;
    report.status = 'closed'; // đổi trạng thái thành 'closed' sau khi phản hồi
    return report.save();
  }

  async deleteReport(id: string) {
    const report = await this.reportModel.findByIdAndDelete(id);
    if (!report) throw new NotFoundException('Report not found');
    return { message: 'Deleted successfully' };
  }
}
