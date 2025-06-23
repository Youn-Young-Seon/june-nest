import { Module } from '@nestjs/common';
import { LoginService } from './login.service';
import { LoginController } from './login.controller';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [CommonModule, AuthModule],
    controllers: [LoginController],
    providers: [LoginService],
})
export class LoginModule {}
