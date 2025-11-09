import { IsEmail, IsOptional, IsNumberString, IsString, Matches, MinLength } from "class-validator";

export class LoginGoogleDto {
    @IsString()
    idToken: string;

    @IsOptional()
    @IsString()
    phone?: string;
}