import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { APP_DEFAULTS } from './shared/app.constants';
import { DatadogConfig } from './observability/datadog.config';
import { StructuredLogger } from './shared/StructuredLogger';

async function bootstrap() {
  DatadogConfig.initialize();

  const app = await NestFactory.create(AppModule);
  const logger = new StructuredLogger();
  app.useLogger(logger);
  (app as any).set('trust proxy', true);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  let ddTracer: any = null;
  try {
    ddTracer = require('dd-trace');
  } catch {
    ddTracer = null;
  }

  app.use((req: any, res: any, next: () => void) => {
    const startedAt = Date.now();
    const activeSpan = ddTracer?.scope?.().active?.();
    const traceId = resolveTraceId(req, activeSpan);
    const clientIp = resolveClientIp(req);

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      logger.log('HTTP request', {
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
        traceId,
        ip: clientIp,
      });
    });

    next();
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FIAPX Video Processor API')
    .setDescription('API para autenticacao e processamento de videos')
    .setVersion('1.0.0')
    .addTag('auth')
    .addTag('videos')
    .addTag('health')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-doc', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = Number(process.env.API_GATEWAY_PORT || APP_DEFAULTS.apiPort);
  await app.listen(port);
  logger.log('API running', { url: `http://localhost:${port}` });
  logger.log('Swagger running', { url: `http://localhost:${port}/api-doc` });
}

bootstrap();

function resolveTraceId(req: any, activeSpan: any): string {
  const activeTraceId = activeSpan?.context?.().toTraceId?.();
  if (activeTraceId) {
    return activeTraceId;
  }

  const datadogTraceId = req.headers?.['x-datadog-trace-id'];
  if (typeof datadogTraceId === 'string' && datadogTraceId.trim()) {
    return datadogTraceId.trim();
  }

  const traceparent = req.headers?.traceparent;
  if (typeof traceparent === 'string' && traceparent.includes('-')) {
    const parts = traceparent.split('-');
    if (parts.length >= 3 && parts[1]) {
      return parts[1];
    }
  }

  const requestId = req.headers?.['x-request-id'];
  if (typeof requestId === 'string' && requestId.trim()) {
    return requestId.trim();
  }

  return 'n/a';
}

function resolveClientIp(req: any): string {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;
  const realIp = req.headers?.['x-real-ip'];

  if (typeof forwardedIp === 'string' && forwardedIp.trim()) {
    return forwardedIp.split(',')[0].trim();
  }

  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return req.ips[0];
  }

  return req.ip || req.socket?.remoteAddress || 'n/a';
}
