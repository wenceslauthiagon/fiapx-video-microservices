import { PrismaService } from '../database/prisma.service';
import { VideoJob } from '../../domain/entities/video-job.entity';
import { IVideoJobRepository } from '../../domain/repositories';

export class PrismaVideoJobRepository implements IVideoJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(job: VideoJob): Promise<VideoJob> {
    const created = await this.prisma.videoJob.create({
      data: {
        id: job.id,
        userId: job.userId,
        originalFileName: job.originalFileName,
        status: job.status,
        progress: job.progress,
        inputPath: job.inputPath,
      },
    });
    return this.toDomain(created);
  }

  async findById(id: string): Promise<VideoJob | null> {
    const found = await this.prisma.videoJob.findUnique({ where: { id } });
    return found ? this.toDomain(found) : null;
  }

  async findByUserId(userId: string, skip = 0, take = 10): Promise<VideoJob[]> {
    const rows = await this.prisma.videoJob.findMany({ where: { userId }, skip, take, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toDomain(row));
  }

  async update(job: VideoJob): Promise<VideoJob> {
    const updated = await this.prisma.videoJob.update({
      where: { id: job.id },
      data: {
        status: job.status,
        progress: job.progress,
        outputPath: job.outputPath,
        frameCount: job.frameCount,
        error: job.error,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      },
    });
    return this.toDomain(updated);
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.videoJob.count({ where: { userId } });
  }

  private toDomain(raw: any): VideoJob {
    const job = new VideoJob(raw.id, raw.userId, raw.originalFileName, raw.inputPath);
    job.status = raw.status;
    job.progress = raw.progress;
    job.outputPath = raw.outputPath ?? undefined;
    job.frameCount = raw.frameCount ?? undefined;
    job.error = raw.error ?? undefined;
    job.createdAt = raw.createdAt;
    job.updatedAt = raw.updatedAt;
    job.startedAt = raw.startedAt ?? undefined;
    job.finishedAt = raw.finishedAt ?? undefined;
    return job;
  }
}
