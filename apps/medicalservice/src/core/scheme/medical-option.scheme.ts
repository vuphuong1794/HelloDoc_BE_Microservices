import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';


@Schema({ timestamps: true })
export class MedicalOption extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  icon: string;
}

export const MedicalOptionSchema = SchemaFactory.createForClass(MedicalOption);