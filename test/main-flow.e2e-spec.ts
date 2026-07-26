import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BullMqService } from '../src/infrastructure/queue/bull-mq.service';
import { VideoQueueOutboxPublisherService } from '../src/infrastructure/queue/video-queue-outbox.publisher';
import { VideoProcessorService } from '../src/video/video-processor.service';

jest.mock('archiver', () => {
  return () => ({
    pipe: jest.fn(),
    directory: jest.fn(),
    on: jest.fn(),
    finalize: jest.fn(),
  });
});

jest.mock('fluent-ffmpeg', () => {
  return () => ({
    setFfmpegPath: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    save: jest.fn(),
  });
});

jest.mock('ffmpeg-static', () => '/usr/bin/ffmpeg');

describe('Main flow e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(VideoProcessorService)
      .useValue({})
      .overrideProvider(VideoQueueOutboxPublisherService)
      .useValue({
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .overrideProvider(BullMqService)
      .useValue({
        publishVideoJob: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.videoJobQueueOutbox.deleteMany();
    await prisma.videoJob.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('TC0001 - Should register, login, upload, list and remove a job', async () => {
    const email = `e2e-${Date.now()}@test.local`;
    const password = '123456';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'E2E User',
        email,
        password,
        confirmPassword: password,
      })
      .expect(201);

    expect(registerResponse.body.access_token).toBeDefined();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    const token = loginResponse.body.access_token as string;
    expect(token).toBeDefined();

    const uploadResponse = await request(app.getHttpServer())
      .post('/videos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('dummy-video-content'), {
        filename: 'sample.mp4',
        contentType: 'video/mp4',
      })
      .expect(201);

    const jobId = uploadResponse.body.id as string;
    expect(jobId).toBeDefined();
    expect(uploadResponse.body.status).toBe('PENDING');

    const listResponse = await request(app.getHttpServer())
      .get('/videos/jobs?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(listResponse.body.jobs)).toBe(true);
    expect(
      listResponse.body.jobs.some((job: { id: string }) => job.id === jobId),
    ).toBe(true);

    await request(app.getHttpServer())
      .delete(`/videos/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listAfterDelete = await request(app.getHttpServer())
      .get('/videos/jobs?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      listAfterDelete.body.jobs.some((job: { id: string }) => job.id === jobId),
    ).toBe(false);
  });
});
