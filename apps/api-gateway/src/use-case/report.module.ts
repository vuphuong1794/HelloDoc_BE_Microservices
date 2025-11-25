import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ReportController } from '../controller/report.controller';
import { ReportService } from '../services/report.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'REPORT_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3017,
                },
            },
        ]),
    ],
    controllers: [ReportController],
    providers: [ReportService],
})
export class ReportModule {}
