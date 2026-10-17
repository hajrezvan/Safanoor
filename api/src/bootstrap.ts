import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ErrorResponseDto } from './libs/http/http.dto';
import { ApiExceptionFilter } from './libs/http/exception.filter';

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
      exceptionFactory: () =>
        new BadRequestException(
          'اطلاعات ورودی معتبر نیست. موارد فرم را بررسی کنید.',
        ),
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
}
export function openApiDocument(app: INestApplication) {
  const options = new DocumentBuilder()
    .setTitle('Safanoor API')
    .setDescription('Versioned privacy-first organization API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('sf_access')
    .build();
  const document = SwaggerModule.createDocument(app, options, {
    extraModels: [ErrorResponseDto],
    operationIdFactory: (controller, method) =>
      `${controller.replace('Controller', '')}_${method}`,
  });
  for (const path of Object.values(document.paths))
    for (const method of ['get', 'post', 'patch', 'delete', 'put'] as const) {
      const operation = path?.[method];
      if (!operation) continue;
      for (const status of [400, 401, 403, 404, 409, 429, 500])
        operation.responses[String(status)] = {
          description: 'Standard API error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponseDto' },
            },
          },
        };
    }
  return document;
}
