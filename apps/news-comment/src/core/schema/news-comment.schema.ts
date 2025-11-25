import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type NewsCommentDocument = NewsComment & Document;

@Schema({ timestamps: true })
export class NewsComment {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, refPath: 'userModel' })
  user: string;

  @Prop({ required: true, enum: ['User', 'Doctor', 'Admin'] })
  userModel: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'News', required: true })
  news: string;

  @Prop({ required: true })
  content: string;
}

export const NewsCommentSchema = SchemaFactory.createForClass(NewsComment);
