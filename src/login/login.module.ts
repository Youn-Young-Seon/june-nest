import { Module } from '@nestjs/common';
import { LoginService } from './login.service';
import { LoginController } from './login.controller';
import { PrismaService } from '../common/prisma.service';
import { CommonModule } from 'src/common/common.module';

@Module({
    imports: [CommonModule],
    controllers: [LoginController],
    providers: [LoginService, PrismaService],
})
export class LoginModule {}
