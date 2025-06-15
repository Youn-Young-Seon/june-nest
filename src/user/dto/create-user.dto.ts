export class CreateUserDto {
    email: string;
    password: string;
    role: "admin" | "user";
}
