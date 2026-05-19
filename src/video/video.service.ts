import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ListVideoJobsUseCase, UploadVideoUseCase } from '../application/use-cases';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PrismaVideoJobRepository } from '../infrastructure/repositories/prisma-video-job.repository';
import { BullMqService } from '../infrastructure/queue/bull-mq.service';

@Injectable()
export class VideoService {
  private readonly jobRepository: PrismaVideoJobRepository;
  private readonly queueService: BullMqService;

  constructor(prisma: PrismaService) {
    this.jobRepository = new PrismaVideoJobRepository(prisma);
    this.queueService = new BullMqService();
  }

  async upload(userId: string, file: Express.Multer.File) {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, file.filename);
    const useCase = new UploadVideoUseCase(this.jobRepository, this.queueService);
    const job = await useCase.execute(userId, file.originalname, filePath);

    return {
      id: job.id,
      status: job.status,
      fileName: job.originalFileName,
      createdAt: job.createdAt,
    };
  }

  async list(userId: string, page = 1, limit = 10) {
    const useCase = new ListVideoJobsUseCase(this.jobRepository);
    return useCase.execute(userId, page, limit);
  }

  async download(jobId: string, userId: string) {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    if (job.userId !== userId) {
      throw new Error('Unauthorized');
    }
    if (!job.isDownloadable()) {
      throw new Error('Job is not ready for download');
    }
    return job.outputPath;
  }
}
