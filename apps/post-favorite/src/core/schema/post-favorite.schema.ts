import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PostFavoriteDocument = PostFavorite & Document;

@Schema({ timestamps: true })
export class PostFavorite {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, refPath: 'userModel' })
  user: string;

  @Prop({ required: true, enum: ['User', 'Doctor'] })
  userModel: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Post', required: true })
  post: string;
}

export const PostFavoriteSchema = SchemaFactory.createForClass(PostFavorite);
