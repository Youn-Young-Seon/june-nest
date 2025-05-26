import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: 'http://localhost:4200', // ✅ 허용할 프론트 주소
    credentials: true, // 쿠키 등 자격 정보 허용 (필요 시)
  });
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
