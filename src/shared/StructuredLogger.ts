import { Injectable, LoggerService } from '@nestjs/common';
import { DatadogConfig } from '../observability/datadog.config';

export type LogLevel = 'info' | 'error' | 'warn' | 'debug';

export interface LogMeta {
  correlationId?: string;
  userId?: string;
  ip?: string;
  service?: string;
  env?: string;
  version?: string;
  [key: string]: any;
}

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly service =
    process.env.DD_SERVICE || 'api-fiapx-hackathon-dev';
  private readonly env =
    process.env.DD_ENV || process.env.NODE_ENV || 'fiapx-hackathon-dev-v1';
  private readonly version = process.env.DD_VERSION || '1.0.0';

  public log(message: string, meta?: LogMeta | string) {
    this.logBase('info', message, meta);
  }

  public error(
    message: string,
    error?: Error | string,
    meta?: LogMeta | string,
  ) {
    let errorObj: Error | null = null;
    if (typeof error === 'string') {
      errorObj = new Error(error);
    } else if (error instanceof Error) {
      errorObj = error;
    }
    const safeMeta: LogMeta =
      typeof meta === 'object' && meta !== null ? meta : {};
    this.logBase('error', message, { ...safeMeta, error: errorObj });
  }

  public warn(message: string, meta?: LogMeta | string) {
    this.logBase('warn', message, meta);
  }

  public debug(message: string, meta?: LogMeta | string) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.logBase('debug', message, meta || {});
    }
  }

  private logBase(
    level: LogLevel,
    message: string,
    meta: LogMeta | string | undefined,
  ) {
    const safeMeta: LogMeta =
      typeof meta === 'object' && meta !== null ? meta : {};
    meta = safeMeta;
    if (meta.request_body) {
      delete meta.request_body.password;
      delete meta.request_body.new_password;
      delete meta.request_body.username;
      delete meta.request_body.email;
    }

    if (meta.request_headers) {
      delete meta.request_headers.authorization;
    }

    const endpointWords = [
      'route',
      'controller',
      'resolver',
      'explorer',
      'mapped',
    ];
    const msg = typeof message === 'string' ? message.toLowerCase() : '';
    if (endpointWords.some((word) => msg.includes(word))) {
      return;
    }

    const logObj = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      env: this.env,
      version: this.version,
      ...meta,
    };

    let consoleMethod: 'log' | 'warn' | 'error' = 'log';
    if (level === 'error') {
      consoleMethod = 'error';
    } else if (level === 'warn') {
      consoleMethod = 'warn';
    }

    console[consoleMethod](JSON.stringify(logObj));
    DatadogConfig.addCustomTags(meta);
  }
}
