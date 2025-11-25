import { IsNotEmpty, IsMongoId } from 'class-validator';

export class GetNewsFavoriteDto {
    @IsNotEmpty()
    @IsMongoId()
    userId: string;
}
