import { IsEmail, IsOptional, IsNumberString, IsString, Matches, MinLength } from "class-validator";

export class SignupDto {
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsNumberString({}, { message: 'Phone number must contain only numbers' })
    @Matches(/^\d{10,11}$/, { message: 'Phone number must be 10-11 digits' })
    @IsString()
    phone: string;

    @IsString()
    @MinLength(6)
    @Matches(/^(?=.*[0-9])/, { message: 'password must contain at least one number' })
    password: string;

    @IsOptional()
    @IsString()
    licenseUrl: string;
}