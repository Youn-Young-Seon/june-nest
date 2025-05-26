import {IsNotEmpty, IsString} from "class-validator";

export class CreateLoginDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsString()
    token: string;
}
