import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message = 'در پردازش درخواست مشکلی پیش آمد.';
    let details: string[] | undefined;
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const value = exception.getResponse();
      if (typeof value === 'string') message = value;
      else if ('message' in value) {
        const text = value.message;
        if (Array.isArray(text))
          details = text.filter(
            (item): item is string => typeof item === 'string',
          );
        else if (typeof text === 'string') message = text;
      }
    } else if (
      exception &&
      typeof exception === 'object' &&
      'code' in exception
    ) {
      const code = exception.code;
      if (code === '23505') {
        status = 409;
        message = 'اطلاعات تکراری است.';
      }
      if (code === '23514' || code === '22P02' || code === '23503') {
        status = 400;
        message = 'اطلاعات با قواعد عضویت یا ساختار گروه سازگار نیست.';
      }
    }
    if (!/[\u0600-\u06FF]/.test(message))
      message =
        (
          {
            400: 'اطلاعات ورودی معتبر نیست.',
            401: 'برای ادامه وارد حساب خود شوید.',
            403: 'اجازهٔ دسترسی به این بخش را ندارید.',
            404: 'موردی پیدا نشد.',
            409: 'اطلاعات با وضعیت فعلی سازگار نیست.',
            429: 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.',
          } as Record<number, string>
        )[status] ?? 'در پردازش درخواست مشکلی پیش آمد.';
    response.status(status).json({
      error: {
        code: `HTTP_${status}`,
        message,
        ...(details ? { details } : {}),
      },
      requestId:
        (request.headers['x-request-id'] as string | undefined) ?? randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }
}
