import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { JwtModule } from "@nestjs/jwt";

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'myJun0913',
            signOptions: { expiresIn: '1h' },
        }),
    ],
    providers: [PrismaService],
    exports: [
        PrismaService, 
        JwtModule
    ],
})  
export class CommonModule {}