import { IsNotEmpty, IsMongoId, IsIn, IsString } from 'class-validator';

export class CreateNewsFavoriteDto {
    @IsNotEmpty()
    @IsMongoId()
    userId: string;

    @IsString()
    @IsNotEmpty()
    @IsIn(['User', 'Doctor', 'Admin'])
    userModel: 'User' | 'Doctor' | 'Admin';
}
