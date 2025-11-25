import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types, Document } from 'mongoose';

export enum AppointmentStatus {
    PENDING = 'pending',
    DONE = 'done',
    CANCELLED = 'cancelled',
}

export enum ExaminationMethod {
    AT_CLINIC = 'at_clinic',
    AT_HOME = 'at_home',
}

@Schema({ timestamps: true })
export class Appointment extends Document {
    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
    doctor: Types.ObjectId;

    // Thêm trường xác định patient là từ model nào
    @Prop({ type: String, required: true, enum: ['User', 'Doctor'] })
    patientModel: string;

    // Tham chiếu động đến model tùy theo patientModel
    @Prop({
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    })
    patient: Types.ObjectId;

    @Prop({ required: true })
    date: Date;

    @Prop({ required: true })
    time: String;

    @Prop({
        required: true,
        enum: AppointmentStatus,
        default: AppointmentStatus.PENDING,
    }) // Dùng enum
    status: AppointmentStatus;

    @Prop({
        required: true,
        enum: ExaminationMethod,
        default: ExaminationMethod.AT_CLINIC,
    })
    examinationMethod: ExaminationMethod;

    @Prop()
    reason?: string;

    @Prop()
    notes?: string;

    @Prop()
    totalCost: string;

    @Prop()
    location?: string; // Địa chỉ khám bệnh (nếu có)
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
