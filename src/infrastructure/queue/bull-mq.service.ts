import Bull from 'bull';
import { Injectable } from '@nestjs/common';
import { IQueueService } from '../../application/use-cases/video/upload-video.use-case';
import { VideoJob } from '../../domain/entities/video-job.entity';
import { APP_DEFAULTS } from '../../shared/app.constants';

@Injectable()
export class BullMqService implements IQueueService {
  private readonly queue: Bull.Queue;
  private readonly videoJobAttempts: number;

  constructor() {
    const configuredAttempts = Number(
      process.env.VIDEO_JOB_ATTEMPTS ?? APP_DEFAULTS.videoJobAttempts,
    );
    this.videoJobAttempts =
      Number.isInteger(configuredAttempts) && configuredAttempts > 0
        ? configuredAttempts
        : APP_DEFAULTS.videoJobAttempts;

    this.queue = new Bull(APP_DEFAULTS.videoQueueName, {
      redis: {
        host: process.env.REDIS_HOST || APP_DEFAULTS.redisHost,
        port: Number(process.env.REDIS_PORT || APP_DEFAULTS.redisPort),
      },
    });
  }

  async publishVideoJob(job: VideoJob): Promise<void> {
    await this.queue.add(
      APP_DEFAULTS.videoQueueJobName,
      {
        jobId: job.id,
        userId: job.userId,
        inputPath: job.inputPath,
        originalFileName: job.originalFileName,
      },
      {
        jobId: job.id,
        attempts: this.videoJobAttempts,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
