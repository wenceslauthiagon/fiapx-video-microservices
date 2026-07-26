import { faker } from '@faker-js/faker/locale/pt_BR';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import * as fs from 'node:fs';

import { VideoService } from '../../../src/video/video.service';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { JobStatus } from '../../../src/domain/entities/video-job.entity';

jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
  }));
});

describe('VideoService', () => {
  let service: VideoService;

  const mockUserId = faker.string.uuid();
  const mockJobId = faker.string.uuid();

  const mockJob = {
    id: mockJobId,
    userId: mockUserId,
    originalFileName: 'test.mp4',
    status: JobStatus.COMPLETED,
    inputPath: '/uploads/test.mp4',
    outputPath: '/outputs/test.zip',
    frameCount: 24,
    progress: 100,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    isDownloadable: () => true,
  };

  const mockFile = {
    originalname: 'test.mp4',
    filename: '123_test.mp4',
    path: '/uploads/123_test.mp4',
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoService,
        {
          provide: PrismaService,
          useValue: {
            videoJob: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VideoService>(VideoService);
  });

  it('Should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('TC0001 - Should create job and queue it', async () => {
      const createdJob = {
        ...mockJob,
        status: JobStatus.PENDING,
        isDownloadable: () => false,
      };

      const transactionVideoJobCreate = jest.fn(() =>
        Promise.resolve(createdJob),
      );
      const transactionOutboxCreate = jest.fn(() => Promise.resolve());

      jest
        .spyOn((service as any).prisma, '$transaction')
        .mockImplementation(async (callback: any) =>
          callback({
            videoJob: {
              create: transactionVideoJobCreate,
            },
            videoJobQueueOutbox: {
              create: transactionOutboxCreate,
            },
          }),
        );

      const result = await service.upload(mockUserId, mockFile);

      expect(result.status).toBe(JobStatus.PENDING);
      expect(result.fileName).toBe('test.mp4');
      expect(transactionVideoJobCreate).toHaveBeenCalledTimes(1);
      expect(transactionOutboxCreate).toHaveBeenCalledTimes(1);
    });

    it('TC0002 - Should throw when file is missing', async () => {
      await expect(
        service.upload(mockUserId, undefined as any),
      ).rejects.toThrow('File is required');
    });

    it('TC0003 - Should throw when file exceeds size limit', async () => {
      const largeFile = {
        ...mockFile,
        size: 60 * 1024 * 1024,
      } as any;

      await expect(service.upload(mockUserId, largeFile)).rejects.toThrow(
        'File too large. Maximum allowed size is 50 MB',
      );
    });

    it('TC0004 - Should write buffer to disk when path is absent', async () => {
      const bufferedFile = {
        originalname: 'unsafe name.mp4',
        filename: '',
        buffer: Buffer.from('video'),
      } as any;
      const transactionVideoJobCreate = jest
        .fn()
        .mockImplementation(async ({ data }: any) => ({
          ...data,
          createdAt: new Date(),
        }));
      const transactionOutboxCreate = jest.fn(() => Promise.resolve());

      jest
        .spyOn((service as any).prisma, '$transaction')
        .mockImplementation(async (callback: any) =>
          callback({
            videoJob: { create: transactionVideoJobCreate },
            videoJobQueueOutbox: { create: transactionOutboxCreate },
          }),
        );

      const result = await service.upload(mockUserId, bufferedFile);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(result.fileName).toBe('unsafe name.mp4');
    });

    it('TC0005 - Should create upload directory when it does not exist', async () => {
      const createdJob = {
        ...mockJob,
        status: JobStatus.PENDING,
        createdAt: new Date(),
      };
      const transactionVideoJobCreate = jest.fn(() =>
        Promise.resolve(createdJob),
      );
      const transactionOutboxCreate = jest.fn(() => Promise.resolve());
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      jest
        .spyOn((service as any).prisma, '$transaction')
        .mockImplementation(async (callback: any) =>
          callback({
            videoJob: { create: transactionVideoJobCreate },
            videoJobQueueOutbox: { create: transactionOutboxCreate },
          }),
        );

      await service.upload(mockUserId, mockFile);

      expect(fs.mkdirSync).toHaveBeenCalledTimes(1);
    });

    it('TC0006 - Should use fallback file name when original name is missing', async () => {
      const fileWithoutName = {
        filename: '',
        buffer: Buffer.from('video'),
      } as any;
      const transactionVideoJobCreate = jest
        .fn()
        .mockImplementation(async ({ data }: any) => ({
          ...data,
          createdAt: new Date(),
        }));
      const transactionOutboxCreate = jest.fn(() => Promise.resolve());
      jest
        .spyOn((service as any).prisma, '$transaction')
        .mockImplementation(async (callback: any) =>
          callback({
            videoJob: { create: transactionVideoJobCreate },
            videoJobQueueOutbox: { create: transactionOutboxCreate },
          }),
        );

      const result = await service.upload(mockUserId, fileWithoutName);

      expect(result.fileName).toMatch(/^\d+-upload\.bin$/);
    });
  });

  describe('list', () => {
    it('TC0001 - Should return paginated jobs for user', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findByUserId')
        .mockResolvedValue([mockJob]);
      jest
        .spyOn((service as any).jobRepository, 'countByUserId')
        .mockResolvedValue(1);

      const result = await service.list(mockUserId, 1, 10);

      expect(result.jobs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('download', () => {
    it('TC0001 - Should return output path for completed job', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(mockJob);

      const result = await service.download(mockJobId, mockUserId);

      expect(result).toBe('/outputs/test.zip');
    });

    it('TC0002 - Should throw when job not found', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(null);

      await expect(service.download(mockJobId, mockUserId)).rejects.toThrow(
        'Job not found',
      );
    });

    it('TC0003 - Should throw when job belongs to another user', async () => {
      const otherUserJob = { ...mockJob, userId: faker.string.uuid() };
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(otherUserJob);

      await expect(service.download(mockJobId, mockUserId)).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('TC0004 - Should throw when job is not downloadable', async () => {
      const pendingJob = {
        ...mockJob,
        status: JobStatus.PENDING,
        isDownloadable: () => false,
      };
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(pendingJob);

      await expect(service.download(mockJobId, mockUserId)).rejects.toThrow(
        'Job is not ready for download',
      );
    });

    it('TC0005 - Should ensure final artifact is ZIP', async () => {
      const zipJob = {
        ...mockJob,
        outputPath: '/outputs/job-123-frames.zip',
        isDownloadable: () => true,
      };
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(zipJob);

      const result = await service.download(mockJobId, mockUserId);

      expect(result).toMatch(/\.zip$/);
    });
  });

  describe('watch', () => {
    it('TC0001 - Should return input path when authorized', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(mockJob);

      const result = await service.watch(mockJobId, mockUserId);

      expect(result).toBe(mockJob.inputPath);
    });

    it('TC0002 - Should throw when watched job is not found', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(null);

      await expect(service.watch(mockJobId, mockUserId)).rejects.toThrow(
        'Job not found',
      );
    });

    it('TC0003 - Should throw when watched job belongs to another user', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue({ ...mockJob, userId: faker.string.uuid() });

      await expect(service.watch(mockJobId, mockUserId)).rejects.toThrow(
        'Unauthorized',
      );
    });
  });

  describe('remove', () => {
    it('TC0001 - Should remove job and files when authorized', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(mockJob);
      jest
        .spyOn((service as any).jobRepository, 'delete')
        .mockResolvedValue(undefined);

      const result = await service.remove(mockJobId, mockUserId);

      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
      expect((service as any).jobRepository.delete).toHaveBeenCalledWith(
        mockJobId,
      );
      expect(result).toEqual({ message: 'Job removido com sucesso' });
    });

    it('TC0002 - Should throw when removed job is not found', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(null);

      await expect(service.remove(mockJobId, mockUserId)).rejects.toThrow(
        'Job not found',
      );
    });

    it('TC0003 - Should throw when removed job belongs to another user', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue({ ...mockJob, userId: faker.string.uuid() });

      await expect(service.remove(mockJobId, mockUserId)).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('TC0004 - Should remove job without deleting files when paths do not exist', async () => {
      jest
        .spyOn((service as any).jobRepository, 'findById')
        .mockResolvedValue(mockJob);
      jest
        .spyOn((service as any).jobRepository, 'delete')
        .mockResolvedValue(undefined);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await service.remove(mockJobId, mockUserId);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Job removido com sucesso' });
    });
  });
});
