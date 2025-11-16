import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from 'src/schemas/Post.schema';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { User, UserSchema } from 'src/schemas/user.schema';
import { Doctor, DoctorSchema } from 'src/schemas/doctor.schema';
import { CacheService } from 'src/cache.service';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { VectorSearchService } from 'src/vector-db/vector-db.service';
import { HuggingFaceService } from 'src/huggingFace/huggingface.service';
import { QdrantService } from 'src/vector-db/qdrant-vectordb.service';

@Module({
  imports: [
    CloudinaryModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
      { name: Doctor.name, schema: DoctorSchema }

    ])],
  controllers: [PostController],
  providers: [PostService, CacheService, EmbeddingService, VectorSearchService, HuggingFaceService, QdrantService],
})
export class PostModule { }
