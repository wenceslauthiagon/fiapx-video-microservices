import { NestFactory } from '@nestjs/core';
import { DatadogConfig } from './observability/datadog.config';
import { StructuredLogger } from './shared/StructuredLogger';
import { WorkerModule } from './worker.module';

async function bootstrapWorker() {
  DatadogConfig.initialize();

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: new StructuredLogger(),
  });

  const logger = new StructuredLogger();
  logger.log('Worker running', {
    queue: 'video-processing',
    concurrency: Number(process.env.VIDEO_WORKER_CONCURRENCY || 3),
  });

  const shutdown = async () => {
    logger.log('Worker shutting down');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrapWorker();
