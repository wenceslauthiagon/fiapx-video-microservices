import { User } from '../entities/user.entity';
import { VideoJob } from '../entities/video-job.entity';

export interface IUserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}

export interface IVideoJobRepository {
  create(job: VideoJob): Promise<VideoJob>;
  findById(id: string): Promise<VideoJob | null>;
  findByUserId(userId: string, skip?: number, take?: number): Promise<VideoJob[]>;
  update(job: VideoJob): Promise<VideoJob>;
  countByUserId(userId: string): Promise<number>;
}
