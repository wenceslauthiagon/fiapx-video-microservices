import { Queue } from 'bull';
import { Injectable } from '@nestjs/common';
import { IQueueService } from '../../application/use-cases/video/upload-video.use-case';
import { VideoJob } from '../../domain/entities/video-job.entity';

@Injectable()
export class BullMqService implements IQueueService {
  private readonly queue: Queue;

  constructor() {
    this.queue = new Queue('video-processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      },
    });
  }

  async publishVideoJob(job: VideoJob): Promise<void> {
    await this.queue.add('process-video', {
      jobId: job.id,
      userId: job.userId,
      inputPath: job.inputPath,
      originalFileName: job.originalFileName,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
