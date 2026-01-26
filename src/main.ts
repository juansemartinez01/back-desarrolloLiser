import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './http/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  
  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'https://frontendliser-production.up.railway.app',
      'https://thriving-forgiveness-pruebas-desarrollo.up.railway.app',
      'https://liser.com.ar',
    ], // o true para permitir todos los orígenes (no recomendado en producción)
    credentials: true, // si usas cookies o autenticación con tokens en headers
  });
  

  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
