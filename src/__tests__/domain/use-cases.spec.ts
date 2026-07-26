import { faker } from '@faker-js/faker/locale/pt_BR';

import { RegisterUserUseCase } from '../../../src/application/use-cases/auth/register-user.use-case';
import { AuthenticateUserUseCase } from '../../../src/application/use-cases/auth/authenticate-user.use-case';
import {
  IUserRepository,
  IVideoJobRepository,
} from '../../../src/domain/repositories';
import { User } from '../../../src/domain/entities/user.entity';
import { UploadVideoUseCase } from '../../../src/application/use-cases/video/upload-video.use-case';
import { ListVideoJobsUseCase } from '../../../src/application/use-cases/video/list-video-jobs.use-case';
import { VideoJob } from '../../../src/domain/entities/video-job.entity';

const makeUser = (): User => {
  const u = new User(
    faker.string.uuid(),
    faker.internet.email(),
    'hashed',
    faker.person.fullName(),
  );
  return u;
};

const makeUserRepository = (
  overrides: Partial<IUserRepository> = {},
): jest.Mocked<IUserRepository> =>
  ({
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    ...overrides,
  }) as jest.Mocked<IUserRepository>;

const makeVideoJob = (): VideoJob =>
  new VideoJob(
    `job_${faker.string.alphanumeric(6)}`,
    faker.string.uuid(),
    'video.mp4',
    '/uploads/video.mp4',
  );

const makeVideoJobRepository = (
  overrides: Partial<IVideoJobRepository> = {},
): jest.Mocked<IVideoJobRepository> =>
  ({
    create: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countByUserId: jest.fn(),
    ...overrides,
  }) as jest.Mocked<IVideoJobRepository>;

describe('RegisterUserUseCase', () => {
  it('TC0001 - Should register new user', async () => {
    const mockUser = makeUser();
    const repo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockUser),
    });
    const useCase = new RegisterUserUseCase(repo);

    const result = await useCase.execute(
      mockUser.email,
      'pass123',
      mockUser.name,
      async (p) => `hash(${p})`,
    );

    expect(repo.create).toHaveBeenCalled();
    expect(result.email).toBe(mockUser.email);
  });

  it('TC0002 - Should throw when email already exists', async () => {
    const mockUser = makeUser();
    const repo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue(mockUser),
    });
    const useCase = new RegisterUserUseCase(repo);

    await expect(
      useCase.execute(mockUser.email, 'pass123', mockUser.name, async (p) => p),
    ).rejects.toThrow('Email already registered');
  });

  it('TC0003 - Should throw when email is invalid', async () => {
    const repo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue(null),
    });
    const useCase = new RegisterUserUseCase(repo);

    await expect(
      useCase.execute('not-valid', 'pass123', 'Name', async (p) => p),
    ).rejects.toThrow('Invalid email format');
  });
});

describe('AuthenticateUserUseCase', () => {
  it('TC0001 - Should return user on valid credentials', async () => {
    const mockUser = makeUser();
    const repo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue(mockUser),
    });
    const useCase = new AuthenticateUserUseCase(repo);

    const result = await useCase.execute(
      mockUser.email,
      'pass',
      async () => true,
    );

    expect(result.id).toBe(mockUser.id);
  });

  it('TC0002 - Should throw when user not found', async () => {
    const repo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue(null),
    });
    const useCase = new AuthenticateUserUseCase(repo);

    await expect(
      useCase.execute('a@b.com', 'pass', async () => true),
    ).rejects.toThrow('Invalid credentials');
  });

  it('TC0003 - Should throw when password is wrong', async () => {
    const mockUser = makeUser();
    const repo = makeUserRepository({
      findByEmail: jest.fn().mockResolvedValue(mockUser),
    });
    const useCase = new AuthenticateUserUseCase(repo);

    await expect(
      useCase.execute(mockUser.email, 'wrong', async () => false),
    ).rejects.toThrow('Invalid credentials');
  });
});

describe('UploadVideoUseCase', () => {
  it('TC0001 - Should create and publish a video job', async () => {
    const job = makeVideoJob();
    const repo = makeVideoJobRepository({
      create: jest.fn().mockResolvedValue(job),
    });
    const queueService = {
      publishVideoJob: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new UploadVideoUseCase(repo, queueService);

    const result = await useCase.execute(
      job.userId,
      job.originalFileName,
      job.inputPath,
    );

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(queueService.publishVideoJob).toHaveBeenCalledWith(job);
    expect(result).toBe(job);
  });
});

describe('ListVideoJobsUseCase', () => {
  it('TC0001 - Should return paginated jobs', async () => {
    const job = makeVideoJob();
    const repo = makeVideoJobRepository({
      findByUserId: jest.fn().mockResolvedValue([job]),
      countByUserId: jest.fn().mockResolvedValue(1),
    });
    const useCase = new ListVideoJobsUseCase(repo);

    const result = await useCase.execute(job.userId, 2, 5);

    expect(repo.findByUserId).toHaveBeenCalledWith(job.userId, 5, 5);
    expect(repo.countByUserId).toHaveBeenCalledWith(job.userId);
    expect(result).toEqual({ jobs: [job], total: 1, page: 2, limit: 5 });
  });

  it('TC0002 - Should use default pagination values', async () => {
    const job = makeVideoJob();
    const repo = makeVideoJobRepository({
      findByUserId: jest.fn().mockResolvedValue([job]),
      countByUserId: jest.fn().mockResolvedValue(1),
    });
    const useCase = new ListVideoJobsUseCase(repo);

    await useCase.execute(job.userId);

    expect(repo.findByUserId).toHaveBeenCalledWith(job.userId, 0, 10);
  });
});
