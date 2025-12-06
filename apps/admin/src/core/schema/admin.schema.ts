import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true })
export class Admin extends Document {
    @Prop({ required: true })
    name: string;
    @Prop({ required: true, unique: true })
    email: string;
    @Prop({ required: true, unique: true })
    phone: string;
    @Prop({ required: true })
    password: string;
    @Prop({ default: "Admin" })
    role: string;
    @Prop({ default: false })
    isDeleted: boolean;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);