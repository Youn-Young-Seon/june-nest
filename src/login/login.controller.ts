import { Controller, Post, Body } from '@nestjs/common';
import { LoginService } from './login.service';
import { LoginDto } from './dto/login.dto';
import { Public } from 'src/auth/decorators';

@Controller('login')
export class LoginController {
    constructor(private readonly loginService: LoginService) {}

    @Public()
    @Post()
    async login(@Body() loginDto: LoginDto) {
        return this.loginService.login(loginDto);
    }
}
