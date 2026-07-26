import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';
process.env.VIDEO_PROCESSOR_ENABLED = process.env.VIDEO_PROCESSOR_ENABLED || 'false';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5436/fiapx_videos';
