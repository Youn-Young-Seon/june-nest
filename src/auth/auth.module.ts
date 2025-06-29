import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { RoleBasedGuard } from './guards';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'myJun0913',
      signOptions: { expiresIn: '30s' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleBasedGuard,
    }
  ],
  exports: [JwtModule],
})
export class AuthModule {}