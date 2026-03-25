import { Type } from "class-transformer";
import { IsEmail, IsOptional, IsNumberString, IsString, Matches, MinLength } from "class-validator";
import { Express } from 'express';


export class updateUserDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEmail({}, { message: 'Invalid email format' })
    email?: string;

    @IsOptional()
    @IsNumberString({}, { message: 'Phone number must contain only numbers' })
    @Matches(/^\d{10,11}$/, { message: 'Phone number must be 10-11 digits' })
    phone?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    @Matches(/^(?=.*[A-Za-z])(?=.*[0-9]).*$/, { message: 'Password must contain at least one letter and one number' })
    password?: string;

    @IsOptional()
    @IsString()
    role?: string;

    @IsOptional()
    @Type(() => Object)
    avatarURL?: Express.Multer.File;
}
