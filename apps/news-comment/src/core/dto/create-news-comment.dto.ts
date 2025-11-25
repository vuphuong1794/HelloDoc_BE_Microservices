import { IsNotEmpty, IsMongoId, IsIn, IsString, IsArray, IsOptional } from 'class-validator';
export class CreateNewsCommentDto {
    @IsNotEmpty()
    @IsMongoId()
    userId: string;

    @IsString()
    content: string;
}
