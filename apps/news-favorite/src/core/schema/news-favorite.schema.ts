import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type NewsFavoriteDocument = NewsFavorite & Document;

@Schema({ timestamps: true })
export class NewsFavorite {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, refPath: 'userModel' })
  user: string;

  @Prop({ required: true, enum: ['User', 'Doctor', 'Admin'] })
  userModel: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'News', required: true })
  news: string;
}

export const NewsFavoriteSchema = SchemaFactory.createForClass(NewsFavorite);
