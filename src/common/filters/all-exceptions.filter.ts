import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 🔴 Log bien explícito en consola (Railway logs)
    console.error('UNHANDLED ERROR:', {
      url: request.url,
      method: request.method,
      message: exception?.message,
      name: exception?.name,
      stack: exception?.stack,
      response: exception?.response,
    });

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return response.status(status).json(res);
    }

    // Mientras estás en pruebas podés devolver más info
    return response.status(500).json({
      statusCode: 500,
      message: exception?.message || 'Internal server error',
      // ⚠️ dejá esto solo en entorno de pruebas, después sacalo:
      error: exception?.stack,
    });
  }
}
