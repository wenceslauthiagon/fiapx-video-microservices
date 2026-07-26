import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { QueueOutboxStatus, Prisma } from '@prisma/client';
import { VideoJob } from '../../domain/entities/video-job.entity';
import { PrismaService } from '../database/prisma.service';
import { APP_DEFAULTS } from '../../shared/app.constants';
import { BullMqService } from './bull-mq.service';

type VideoQueuePayload = {
  jobId: string;
  userId: string;
  inputPath: string;
  originalFileName: string;
};

@Injectable()
export class VideoQueueOutboxPublisherService
  implements OnModuleInit, OnModuleDestroy
{
  private dispatchTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: BullMqService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dispatchPending();
    this.dispatchTimer = setInterval(() => {
      void this.dispatchPending();
    }, APP_DEFAULTS.outboxDispatchIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.dispatchTimer) {
      clearInterval(this.dispatchTimer);
    }
  }

  async dispatchPending(): Promise<void> {
    const now = new Date();
    const claimCutoff = new Date(
      now.getTime() - APP_DEFAULTS.outboxClaimTimeoutMs,
    );

    const candidates = await this.prisma.videoJobQueueOutbox.findMany({
      where: {
        OR: [
          {
            status: QueueOutboxStatus.PENDING,
            nextAttemptAt: null,
          },
          {
            status: QueueOutboxStatus.PENDING,
            nextAttemptAt: {
              lte: now,
            },
          },
          {
            status: QueueOutboxStatus.PROCESSING,
            processingStartedAt: {
              lt: claimCutoff,
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: APP_DEFAULTS.outboxBatchSize,
    });

    for (const outboxItem of candidates) {
      const claimed = await this.prisma.videoJobQueueOutbox.updateMany({
        where: {
          id: outboxItem.id,
          OR: [
            {
              status: QueueOutboxStatus.PENDING,
              nextAttemptAt: null,
            },
            {
              status: QueueOutboxStatus.PENDING,
              nextAttemptAt: {
                lte: now,
              },
            },
            {
              status: QueueOutboxStatus.PROCESSING,
              processingStartedAt: {
                lt: claimCutoff,
              },
            },
          ],
        },
        data: {
          status: QueueOutboxStatus.PROCESSING,
          processingStartedAt: now,
          lastError: null,
        },
      });

      if (claimed.count === 0) {
        continue;
      }

      const payload =
        outboxItem.payload as Prisma.JsonObject as VideoQueuePayload;
      const job: VideoJob = {
        id: payload.jobId,
        userId: payload.userId,
        inputPath: payload.inputPath,
        originalFileName: payload.originalFileName,
        status: 'PENDING' as const,
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as VideoJob;

      try {
        await this.queueService.publishVideoJob(job);

        await this.prisma.videoJobQueueOutbox.update({
          where: { id: outboxItem.id },
          data: {
            status: QueueOutboxStatus.DISPATCHED,
            dispatchedAt: now,
            processingStartedAt: null,
            lastError: null,
          },
        });
      } catch (error) {
        const reason =
          error instanceof Error
            ? error.message
            : 'Failed to publish job to queue';
        const retryDelayMs = this.resolveRetryDelayMs(outboxItem.attempts);

        await this.prisma.videoJobQueueOutbox.update({
          where: { id: outboxItem.id },
          data: {
            status: QueueOutboxStatus.PENDING,
            attempts: { increment: 1 },
            processingStartedAt: null,
            lastError: reason,
            nextAttemptAt: new Date(now.getTime() + retryDelayMs),
          },
        });
      }
    }
  }

  private resolveRetryDelayMs(attempts: number): number {
    const cappedAttempt = Math.min(attempts, 5);
    return Math.min(60_000, 2_000 * 2 ** cappedAttempt);
  }
}
