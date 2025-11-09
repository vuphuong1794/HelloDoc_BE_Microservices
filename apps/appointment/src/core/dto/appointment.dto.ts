import { IsNotEmpty, IsMongoId, IsString, IsEnum, IsOptional, IsDateString, Matches } from 'class-validator';

export class BookAppointmentDto {

    @IsNotEmpty()
    @IsMongoId()
    doctorID: string;

    @IsNotEmpty()
    @IsMongoId()
    patientID: string;

    @IsNotEmpty()
    @IsString()
    patientModel: string;

    @IsNotEmpty()
    @IsString()
    date: string; // Định dạng chuẩn ISO 8601 (YYYY-MM-DD)

    @IsNotEmpty()
    @Matches(/^([0-1]\d|2[0-3]):([0-5]\d)$/, {
        message: 'Time must be in HH:mm format',
    })
    time: string; // Chỉ chấp nhận định dạng HH:mm (24h)

    @IsOptional()
    @IsEnum(['pending', 'done', 'cancelled'], {
        message: 'Status must be pending, done, or cancelled',
    })
    status?: string = 'pending'; // Mặc định là 'pending'

    @IsOptional()
    @IsEnum(['at_clinic', 'at_home'], {
        message: 'Consultation method must be at_clinic or at_home',
    })
    examinationMethod?: string = 'at_clinic'; // Mặc định là 'at_clinic'

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    totalCost: string;

    @IsString()
    location?: string; // Địa chỉ khám bệnh (nếu có)
}
