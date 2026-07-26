import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { QueueOutboxStatus } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { JobStatus } from '../domain/entities/video-job.entity';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PrismaVideoJobRepository } from '../infrastructure/repositories/prisma-video-job.repository';
import { APP_DEFAULTS } from '../shared/app.constants';
import { VIDEO_MESSAGES } from './video.constants';

type UploadFile = {
  originalname?: string;
  filename?: string;
  path?: string;
  size?: number;
  buffer?: Buffer;
};

@Injectable()
export class VideoService {
  private readonly jobRepository: PrismaVideoJobRepository;
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.jobRepository = new PrismaVideoJobRepository(prisma);
  }

  async upload(userId: string, file: UploadFile) {
    if (!file) {
      throw new BadRequestException(VIDEO_MESSAGES.fileRequired);
    }

    if (
      typeof file.size === 'number' &&
      file.size > APP_DEFAULTS.maxVideoSizeBytes
    ) {
      throw new PayloadTooLargeException(VIDEO_MESSAGES.fileTooLarge);
    }

    const uploadDir = process.env.UPLOAD_DIR || APP_DEFAULTS.uploadDir;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeOriginalName = (
      file.originalname || VIDEO_MESSAGES.defaultUploadName
    ).replace(/[^a-zA-Z0-9._-]/g, '_');
    const generatedName = `${Date.now()}-${safeOriginalName}`;
    const storedFileName = file.filename || generatedName;
    const filePath = file.path || path.join(uploadDir, storedFileName);

    if (!file.path && file.buffer) {
      fs.writeFileSync(filePath, file.buffer);
    }

    const originalFileName = file.originalname || storedFileName;
    const jobId = `job_${Date.now()}`;

    const createdJob = await this.prisma.$transaction(async (tx) => {
      const job = await tx.videoJob.create({
        data: {
          id: jobId,
          userId,
          originalFileName,
          status: JobStatus.PENDING,
          progress: 0,
          inputPath: filePath,
        },
      });

      await tx.videoJobQueueOutbox.create({
        data: {
          jobId: job.id,
          payload: {
            jobId: job.id,
            userId: job.userId,
            inputPath: job.inputPath,
            originalFileName: job.originalFileName,
          },
          status: QueueOutboxStatus.PENDING,
        },
      });

      return job;
    });

    return {
      id: createdJob.id,
      status: createdJob.status,
      fileName: createdJob.originalFileName,
      createdAt: createdJob.createdAt,
    };
  }

  async list(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const jobs = await this.jobRepository.findByUserId(userId, skip, limit);
    const total = await this.jobRepository.countByUserId(userId);
    return { jobs, total, page, limit };
  }

  async download(jobId: string, userId: string) {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(VIDEO_MESSAGES.jobNotFound);
    }
    if (job.userId !== userId) {
      throw new Error(VIDEO_MESSAGES.unauthorized);
    }
    if (!job.isDownloadable()) {
      throw new Error(VIDEO_MESSAGES.jobNotReadyForDownload);
    }
    return job.outputPath;
  }

  async watch(jobId: string, userId: string) {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(VIDEO_MESSAGES.jobNotFound);
    }
    if (job.userId !== userId) {
      throw new Error(VIDEO_MESSAGES.unauthorized);
    }
    return job.inputPath;
  }

  async remove(jobId: string, userId: string) {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(VIDEO_MESSAGES.jobNotFound);
    }
    if (job.userId !== userId) {
      throw new Error(VIDEO_MESSAGES.unauthorized);
    }

    if (job.inputPath && fs.existsSync(job.inputPath)) {
      fs.unlinkSync(job.inputPath);
    }
    if (job.outputPath && fs.existsSync(job.outputPath)) {
      fs.unlinkSync(job.outputPath);
    }

    await this.jobRepository.delete(jobId);
    return { message: VIDEO_MESSAGES.jobRemovedSuccess };
  }
}
