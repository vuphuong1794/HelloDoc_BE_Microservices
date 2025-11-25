import { IsNotEmpty, IsMongoId, IsIn, IsString } from 'class-validator';

export class CreatePostFavoriteDto {
    @IsNotEmpty()
    @IsMongoId()
    userId: string;

    @IsString()
    @IsNotEmpty()
    @IsIn(['User', 'Doctor'])
    userModel: string;
}
