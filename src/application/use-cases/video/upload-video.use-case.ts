import { VideoJob } from '../../../domain/entities/video-job.entity';
import { IVideoJobRepository } from '../../../domain/repositories';

export interface IQueueService {
  publishVideoJob(job: VideoJob): Promise<void>;
}

export class UploadVideoUseCase {
  constructor(
    private readonly jobRepository: IVideoJobRepository,
    private readonly queueService: IQueueService,
  ) {}

  async execute(
    userId: string,
    fileName: string,
    filePath: string,
  ): Promise<VideoJob> {
    const job = new VideoJob(`job_${Date.now()}`, userId, fileName, filePath);
    const saved = await this.jobRepository.create(job);
    await this.queueService.publishVideoJob(saved);
    return saved;
  }
}
