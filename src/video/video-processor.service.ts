import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import Bull from 'bull';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as fs from 'node:fs';
import * as nodemailer from 'nodemailer';
import * as path from 'node:path';
import { JobStatus } from '../domain/entities/video-job.entity';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PrismaVideoJobRepository } from '../infrastructure/repositories/prisma-video-job.repository';
import { APP_DEFAULTS } from '../shared/app.constants';

type VideoQueuePayload = {
  jobId: string;
  userId: string;
  inputPath: string;
  originalFileName: string;
};

type ZipArchiveModule = {
  ZipArchive: new (options?: { zlib?: { level?: number } }) => {
    on(event: 'error', listener: (error: Error) => void): void;
    pipe(destination: NodeJS.WritableStream): void;
    directory(sourceDir: string, destPath: false | string): void;
    finalize(): Promise<void>;
  };
};

@Injectable()
export class VideoProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly queue: Bull.Queue<VideoQueuePayload>;
  private readonly jobRepository: PrismaVideoJobRepository;
  private readonly prisma: PrismaService;
  private readonly smtpTransporter: nodemailer.Transporter;
  private processorEnabled = true;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.jobRepository = new PrismaVideoJobRepository(prisma);
    this.queue = new Bull<VideoQueuePayload>(APP_DEFAULTS.videoQueueName, {
      redis: {
        host: process.env.REDIS_HOST || APP_DEFAULTS.redisHost,
        port: Number(process.env.REDIS_PORT || APP_DEFAULTS.redisPort),
      },
    });

    const smtpSecure =
      (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const transportOptions: Record<string, unknown> = {
      host: process.env.SMTP_HOST || APP_DEFAULTS.smtpHost,
      port: Number(process.env.SMTP_PORT || APP_DEFAULTS.smtpPort),
      secure: smtpSecure,
    };

    if (smtpUser && smtpPass) {
      transportOptions.auth = { user: smtpUser, pass: smtpPass };
    }

    this.smtpTransporter = nodemailer.createTransport(transportOptions);
  }

  async onModuleInit(): Promise<void> {
    this.processorEnabled =
      (process.env.VIDEO_PROCESSOR_ENABLED || 'true').toLowerCase() === 'true';
    if (!this.processorEnabled) {
      console.log(
        '[VideoProcessor] Worker disabled by VIDEO_PROCESSOR_ENABLED=false',
      );
      return;
    }

    const workerConcurrency = Number(
      process.env.VIDEO_WORKER_CONCURRENCY || APP_DEFAULTS.workerConcurrency,
    );

    this.queue.process(
      APP_DEFAULTS.videoQueueJobName,
      workerConcurrency,
      async (queueJob) => {
        const { jobId, inputPath, originalFileName } = queueJob.data;
        const startedAtMs = Date.now();
        console.log(`[VideoProcessor] Start job=${jobId} input=${inputPath}`);
        const domainJob = await this.jobRepository.findById(jobId);

        if (!domainJob) {
          throw new Error(`Job not found: ${jobId}`);
        }

        domainJob.status = JobStatus.PROCESSING;
        domainJob.progress = 10;
        domainJob.startedAt = new Date();
        await this.jobRepository.update(domainJob);

        const outputDir = process.env.OUTPUT_DIR || APP_DEFAULTS.outputDir;
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const sourcePath = inputPath;
        const framesDir = path.join(outputDir, `${jobId}-frames`);
        const outputPath = path.join(outputDir, `${jobId}-frames.zip`);

        try {
          domainJob.progress = 40;
          await this.jobRepository.update(domainJob);

          if (fs.existsSync(framesDir)) {
            fs.rmSync(framesDir, { recursive: true, force: true });
          }
          fs.mkdirSync(framesDir, { recursive: true });

          await this.extractFrames(sourcePath, framesDir);

          const frameFiles = fs
            .readdirSync(framesDir)
            .filter((fileName) => fileName.endsWith('.jpg'));

          if (frameFiles.length === 0) {
            throw new Error('No frames generated from video');
          }

          domainJob.progress = 80;
          await this.jobRepository.update(domainJob);

          await this.createZipFromDirectory(framesDir, outputPath);

          domainJob.outputPath = outputPath;
          domainJob.frameCount = frameFiles.length;
          domainJob.progress = 100;
          domainJob.status = JobStatus.COMPLETED;
          domainJob.finishedAt = new Date();
          domainJob.error = undefined;
          await this.jobRepository.update(domainJob);

          fs.rmSync(framesDir, { recursive: true, force: true });

          await this.notifyUser(
            domainJob.id,
            domainJob.userId,
            `Seu video ${originalFileName} foi processado com sucesso e o ZIP com frames esta pronto para download.`,
            true,
          );

          const durationMs = Date.now() - startedAtMs;
          console.log(
            `[VideoProcessor] Completed job=${jobId} durationMs=${durationMs} output=${outputPath}`,
          );
        } catch (error) {
          domainJob.status = JobStatus.FAILED;
          domainJob.error =
            error instanceof Error ? error.message : 'Unknown processing error';
          domainJob.finishedAt = new Date();
          await this.jobRepository.update(domainJob);
          const maxAttempts = Number(queueJob.opts.attempts || 1);
          const currentAttempt = queueJob.attemptsMade + 1;
          const isLastAttempt = currentAttempt >= maxAttempts;

          if (isLastAttempt) {
            await this.notifyUser(
              domainJob.id,
              domainJob.userId,
              `Falha ao processar video ${originalFileName}: ${domainJob.error}`,
              false,
            );
          } else {
            console.warn(
              `[VideoProcessor] Retry scheduled job=${jobId} attempt=${currentAttempt}/${maxAttempts} error=${domainJob.error}`,
            );
          }

          const durationMs = Date.now() - startedAtMs;
          console.error(
            `[VideoProcessor] Failed job=${jobId} durationMs=${durationMs} error=${domainJob.error}`,
          );
          throw error;
        }
      },
    );

    this.queue.on('error', (error) => {
      console.error('[VideoProcessor] Queue error:', error.message);
    });

    console.log(
      `[VideoProcessor] Worker ready for queue: video-processing (concurrency=${workerConcurrency})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  private async extractFrames(
    sourcePath: string,
    framesDir: string,
  ): Promise<void> {
    if (!ffmpegPath) {
      throw new Error('ffmpeg binary not available');
    }
    const resolvedFfmpegPath: string = ffmpegPath;
    const framePattern = path.join(framesDir, 'frame-%05d.jpg');

    await new Promise<void>((resolve, reject) => {
      ffmpeg(sourcePath)
        .setFfmpegPath(resolvedFfmpegPath)
        .outputOptions(['-vf fps=1'])
        .on('end', () => resolve())
        .on('error', (error: unknown) => reject(error))
        .save(framePattern);
    });
  }

  private async createZipFromDirectory(
    sourceDir: string,
    zipPath: string,
  ): Promise<void> {
    const { ZipArchive } =
      (await import('archiver')) as unknown as ZipArchiveModule;

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (error: Error) => reject(error));

      archive.pipe(output);
      archive.directory(sourceDir, false);
      void archive.finalize();
    });
  }

  private async notifyUser(
    jobId: string,
    userId: string,
    message: string,
    success: boolean,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.warn(
        `[VideoProcessor] Notification skipped: user not found userId=${userId}`,
      );
      return;
    }

    let sent = false;
    try {
      await this.smtpTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@fiapx.local',
        to: user.email,
        subject: success
          ? 'Processamento de video concluido'
          : 'Falha no processamento de video',
        text: message,
      });
      sent = true;
      console.log(
        `[VideoProcessor] Notification email sent job=${jobId} user=${user.email}`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(
        `[VideoProcessor] Notification email failed job=${jobId} reason=${reason}`,
      );
    }

    await this.prisma.notification.create({
      data: {
        jobId,
        type: NotificationType.EMAIL,
        message,
        sent,
        sentAt: sent ? new Date() : null,
      },
    });
  }
}
