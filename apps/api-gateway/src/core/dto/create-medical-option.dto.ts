import { IsString } from "class-validator";

export class CreateMedicalOptionDto {
    @IsString()
    name: string;
    icon?: string;
}

