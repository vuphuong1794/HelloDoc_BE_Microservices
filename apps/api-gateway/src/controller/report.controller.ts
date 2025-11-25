import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { CreateReportDto } from '../core/dto/report/create-report.dto';
import { UpdateReportStatusDto, UpdateReportResponseDto } from '../core/dto/report/update-report.dto';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  async create(@Body() createReportDto: CreateReportDto) {
    return this.reportService.create(createReportDto);
  }

  @Get()
  async getAll() {
    return this.reportService.getAll();
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateReportStatusDto,
  ) {
    return this.reportService.updateStatus(id, updateStatusDto.status);
  }

  @Patch(':id/response')
  async updateResponse(
    @Param('id') id: string,
    @Body() updateResponseDto: UpdateReportResponseDto,
  ) {
    return this.reportService.updateResponse(
      id,
      updateResponseDto.responseContent,
      updateResponseDto.responseTime,
    );
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.reportService.delete(id);
  }
}
