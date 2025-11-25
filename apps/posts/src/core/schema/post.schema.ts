import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { IsString, IsEmail, IsBoolean, IsOptional, IsNumber, Min, IsUrl } from 'class-validator';
@Schema({ timestamps: true })
export class Post {
    @Prop({ type: mongoose.Schema.Types.ObjectId, auto: true })
    _id: Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId })
    user: Types.ObjectId;

    @Prop({ type: String, required: true, enum: ['User', 'Doctor'] })
    userModel: string;

    @Prop({ type: String, required: true })
    content: string;

    @Prop({ type: [String], default: [] })
    media?: string[];

    // @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] })
    // likes: mongoose.Schema.Types.ObjectId[];

    @Prop({ type: Boolean, default: false })
    isHidden: boolean;

    @Prop({ type: String, default: '' })
    keywords: string;

    @Prop({ type: [Number], default: [] })
    embedding: number[];

    @Prop({ default: 'BAAI/bge-m3' })
    embeddingModel: string;

    @Prop()
    embeddingUpdatedAt: Date;

    @Prop({ default: 0 })
    searchScore: number;

    userInfo: {
        _id: string,
        name: string,
        avatarURL?: string
    }

    @Prop()
    createdAt: Date; 

    @Prop()
    updatedAt: Date;  


}

export const PostSchema = SchemaFactory.createForClass(Post);

