import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, refPath: 'reporterModel' })
  reporter: string;

  @Prop({ required: true, enum: ['User', 'Doctor'] })
  reporterModel: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, enum: ['Người dùng', 'Bác sĩ', 'Ứng dụng', 'Bài viết'] })
  type: string;

  @Prop({ required: true })
  reportedId: string;

  @Prop({ required: false })
  postId?: string;

  @Prop({ default: 'opened', enum: ['opened', 'closed'] })
  status: string;

  @Prop({ required: false })
  responseContent?: string;

  @Prop({ required: false })
  responseTime?: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
