export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class VideoJob {
  id: string;
  userId: string;
  originalFileName: string;
  status: JobStatus;
  progress: number;
  inputPath: string;
  outputPath?: string;
  frameCount?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;

  constructor(id: string, userId: string, originalFileName: string, inputPath: string) {
    this.id = id;
    this.userId = userId;
    this.originalFileName = originalFileName;
    this.inputPath = inputPath;
    this.status = JobStatus.PENDING;
    this.progress = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  isDownloadable(): boolean {
    return this.status === JobStatus.COMPLETED && !!this.outputPath;
  }
}
