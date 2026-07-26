import { faker } from '@faker-js/faker/locale/pt_BR';

import { PrismaUserRepository } from '../../../src/infrastructure/repositories/prisma-user.repository';
import { PrismaVideoJobRepository } from '../../../src/infrastructure/repositories/prisma-video-job.repository';
import { User } from '../../../src/domain/entities/user.entity';
import {
  JobStatus,
  VideoJob,
} from '../../../src/domain/entities/video-job.entity';

describe('PrismaUserRepository', () => {
  const mockPrisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TC0001 - Should create and map a user entity', async () => {
    const repository = new PrismaUserRepository(mockPrisma);
    const user = new User(
      faker.string.uuid(),
      faker.internet.email(),
      'hashed',
      faker.person.fullName(),
    );
    mockPrisma.user.create.mockResolvedValue({ ...user });

    const result = await repository.create(user);

    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(User);
    expect(result.email).toBe(user.email);
  });

  it('TC0002 - Should return user when findById matches', async () => {
    const repository = new PrismaUserRepository(mockPrisma);
    const user = {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      password: 'hashed',
      name: faker.person.fullName(),
    };
    mockPrisma.user.findUnique.mockResolvedValue(user);

    const result = await repository.findById(user.id);

    expect(result).toBeInstanceOf(User);
    expect(result?.id).toBe(user.id);
  });

  it('TC0003 - Should return null when findById does not match', async () => {
    const repository = new PrismaUserRepository(mockPrisma);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await repository.findById(faker.string.uuid());

    expect(result).toBeNull();
  });

  it('TC0004 - Should return user when findByEmail matches', async () => {
    const repository = new PrismaUserRepository(mockPrisma);
    const user = {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      password: 'hashed',
      name: faker.person.fullName(),
    };
    mockPrisma.user.findUnique.mockResolvedValue(user);

    const result = await repository.findByEmail(user.email);

    expect(result).toBeInstanceOf(User);
    expect(result?.email).toBe(user.email);
  });

  it('TC0005 - Should return null when findByEmail does not match', async () => {
    const repository = new PrismaUserRepository(mockPrisma);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await repository.findByEmail(faker.internet.email());

    expect(result).toBeNull();
  });
});

describe('PrismaVideoJobRepository', () => {
  const mockPrisma = {
    videoJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  } as any;

  const makeRawJob = () => ({
    id: `job_${faker.string.alphanumeric(6)}`,
    userId: faker.string.uuid(),
    originalFileName: 'video.mp4',
    status: JobStatus.COMPLETED,
    progress: 100,
    inputPath: '/uploads/video.mp4',
    outputPath: '/outputs/video.zip',
    frameCount: 10,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date(),
    finishedAt: new Date(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TC0001 - Should create and map a video job entity', async () => {
    const repository = new PrismaVideoJobRepository(mockPrisma);
    const rawJob = makeRawJob();
    const job = new VideoJob(
      rawJob.id,
      rawJob.userId,
      rawJob.originalFileName,
      rawJob.inputPath,
    );
    mockPrisma.videoJob.create.mockResolvedValue(rawJob);

    const result = await repository.create(job);

    expect(mockPrisma.videoJob.create).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(VideoJob);
    expect(result.id).toBe(rawJob.id);
  });

  it('TC0002 - Should return video job when findById matches', async () => {
    const repository = new PrismaVideoJobRepository(mockPrisma);
    const rawJob = makeRawJob();
    mockPrisma.videoJob.findUnique.mockResolvedValue(rawJob);

    const result = await repository.findById(rawJob.id);

    expect(result).toBeInstanceOf(VideoJob);
    expect(result?.id).toBe(rawJob.id);
  });

  it('TC0003 - Should return null when findById does not match', async () => {
    const repository = new PrismaVideoJobRepository(mockPrisma);
    mockPrisma.videoJob.findUnique.mockResolvedValue(null);

    const result = await repository.findById('missing');

    expect(result).toBeNull();
  });

  it('TC0004 - Should return paginated mapped jobs', async () => {
    const repository = new PrismaVideoJobRepository(mockPrisma);
    const rawJob = makeRawJob();
    mockPrisma.videoJob.findMany.mockResolvedValue([rawJob]);

    const result = await repository.findByUserId(rawJob.userId, 2, 3);

    expect(mockPrisma.videoJob.findMany).toHaveBeenCalledWith({
      where: { userId: rawJob.userId },
      skip: 2,
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    expect(result[0]).toBeInstanceOf(VideoJob);
  });

  it('TC0005 - Should update and map a video job entity', async () => {
    const repository = new PrismaVideoJobRepository(mockPrisma);
    const rawJob = makeRawJob();
    const job = new VideoJob(
      rawJob.id,
      rawJob.userId,
      rawJob.originalFileName,
      rawJob.inputPath,
    );
    job.status = JobStatus.COMPLETED;
    job.progress = 100;
    job.outputPath = rawJob.outputPath;
    job.frameCount = rawJob.frameCount;
    mockPrisma.videoJob.update.mockResolvedValue(rawJob);

    const result = await repository.update(job);

    expect(mockPrisma.videoJob.update).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(VideoJob);
    expect(result.outputPath).toBe(rawJob.outputPath);
  });

  it('TC0006 - Should map nullable fields to undefined', async () => {
    const repository = new PrismaVideoJobRepository(mockPrisma);
    const rawJob = {
      ...makeRawJob(),
      outputPath: null,
      frameCount: null,
      error: null,
      startedAt: null,
      finishedAt: null,
    };
    mockPrisma.videoJob.findUnique.mockResolvedValue(rawJob);

    const result = await repository.findById(rawJob.id);

    expect(result?.outputPath).toBeUndefined();
    expect(result?.frameCount).toBeUndefined();
    expect(result?.startedAt).toBeUndefined();
    expect(result?.finishedAt).toBeUndefined();
  });

  it('TC0007 - Should delete a video job by id', async () => {
    const repository = new PrismaVideoJobRepository(mockPrisma);
    mockPrisma.videoJob.delete.mockResolvedValue({});

    await repository.delete('job-id');

    expect(mockPrisma.videoJob.delete).toHaveBeenCalledWith({
      where: { id: 'job-id' },
    });
  });

  it('TC0008 - Should count jobs by user id', async () => {
    const repository = new PrismaVideoJobRepository(mockPrisma);
    const userId = faker.string.uuid();
    mockPrisma.videoJob.count.mockResolvedValue(7);

    const result = await repository.countByUserId(userId);

    expect(mockPrisma.videoJob.count).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(result).toBe(7);
  });
});
