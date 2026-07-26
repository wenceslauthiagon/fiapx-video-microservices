import { Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { BullMqService } from '../infrastructure/queue/bull-mq.service';
import { VideoQueueOutboxPublisherService } from '../infrastructure/queue/video-queue-outbox.publisher';
import { VideoController } from './video.controller';
import { VideoProcessorService } from './video-processor.service';
import { VideoService } from './video.service';

@Module({
  controllers: [VideoController],
  providers: [
    VideoService,
    VideoProcessorService,
    VideoQueueOutboxPublisherService,
    BullMqService,
    PrismaService,
  ],
})
export class VideoModule {}
