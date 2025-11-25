import { IsNotEmpty, IsMongoId } from 'class-validator';

export class GetPostFavoriteDto {
    @IsNotEmpty()
    @IsMongoId()
    userId: string;
}
