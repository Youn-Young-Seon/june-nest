import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { LoginModule } from './login/login.module';
import { CommonModule } from './common/common.module';
import { UserModule } from './user/user.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // ConfigModule.forRoot({
    //   isGlobal: true,
    //   validationSchema: Joi.object({
    //     NODE_ENV: Joi.string()
    //       .valid('development', 'production', 'test')
    //       .default('development'),
    //     PORT: Joi.number().default(3000),
    //     DATABASE_URL: Joi.string().required(),
    //     JWT_SECRET: Joi.string().required(),
    //     JWT_EXPIRATION: Joi.string().default('1h'),
    //   }),
    // }),
    LoginModule,
    CommonModule,
    UserModule,
    AuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware)
      .forRoutes('*path');
  }
}
