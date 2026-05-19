import { IVideoJobRepository } from '../../../domain/repositories';

export class ListVideoJobsUseCase {
  constructor(private readonly jobRepository: IVideoJobRepository) {}

  async execute(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const jobs = await this.jobRepository.findByUserId(userId, skip, limit);
    const total = await this.jobRepository.countByUserId(userId);
    return { jobs, total, page, limit };
  }
}
