import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PostCommentDocument = PostComment & Document;

@Schema({ timestamps: true })
export class PostComment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: string;

  @Prop({ required: true })
  userModel: string; // 'User' or 'Doctor'

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Post', required: true })
  post: string;

  @Prop({ required: true })
  content: string;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);
