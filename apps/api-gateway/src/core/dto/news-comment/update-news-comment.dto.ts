import { PartialType } from '@nestjs/mapped-types';
import { CreateNewsCommentDto } from "./create-news-comment.dto";

export class UpdateNewsCommentDto extends PartialType(CreateNewsCommentDto) { }
