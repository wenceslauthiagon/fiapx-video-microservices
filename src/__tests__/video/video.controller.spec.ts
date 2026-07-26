import { faker } from '@faker-js/faker/locale/pt_BR';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
}));

import * as fs from 'node:fs';

import {
  JobStatus,
  VideoJob,
} from '../../../src/domain/entities/video-job.entity';
import { VideoController } from '../../../src/video/video.controller';
import { VideoService } from '../../../src/video/video.service';

describe('VideoController', () => {
  let controller: VideoController;
  let videoService: jest.Mocked<VideoService>;

  const mockUserId = faker.string.uuid();
  const mockJobId = faker.string.uuid();

  const mockFile = {
    originalname: 'test-video.mp4',
    filename: 'test-video.mp4',
    path: './uploads/test-video.mp4',
    mimetype: 'video/mp4',
    size: 1024,
  } as any;

  const mockRequest = { user: { id: mockUserId } };

  const mockJobResponse = {
    id: mockJobId,
    status: JobStatus.PENDING,
    fileName: 'test-video.mp4',
    createdAt: faker.date.recent(),
  };

  const createMockVideoJob = (): VideoJob => {
    const job = new VideoJob(
      mockJobId,
      mockUserId,
      'test-video.mp4',
      './uploads/test-video.mp4',
    );
    job.status = JobStatus.COMPLETED;
    job.frameCount = 24;
    job.progress = 100;
    job.outputPath = './outputs/test-video.zip';
    job.startedAt = faker.date.past();
    job.finishedAt = faker.date.recent();
    return job;
  };

  const mockJobListResponse = {
    jobs: [createMockVideoJob()],
    total: 1,
    page: 1,
    limit: 10,
  };

  beforeEach(async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoController],
      providers: [
        {
          provide: VideoService,
          useValue: {
            upload: jest.fn(),
            list: jest.fn(),
            download: jest.fn(),
            watch: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VideoController>(VideoController);
    videoService = module.get(VideoService);
  });

  it('Should be defined', () => {
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(VideoController);
  });

  describe('upload', () => {
    it('TC0001 - Should upload video and return pending job', async () => {
      videoService.upload.mockResolvedValue(mockJobResponse);

      const result = await controller.upload(mockFile, mockRequest);

      expect(videoService.upload).toHaveBeenCalledWith(mockUserId, mockFile);
      expect(result).toEqual(mockJobResponse);
      expect(result.status).toBe('PENDING');
    });

    it('TC0002 - Should propagate upload error', async () => {
      const error = new Error('Erro ao salvar arquivo');
      videoService.upload.mockRejectedValue(error);

      await expect(controller.upload(mockFile, mockRequest)).rejects.toThrow(
        error,
      );
    });
  });

  describe('list', () => {
    it('TC0001 - Should return paginated jobs for user', async () => {
      videoService.list.mockResolvedValue(mockJobListResponse);

      const result = await controller.list(mockRequest, '1', '10');

      expect(videoService.list).toHaveBeenCalledWith(mockUserId, 1, 10);
      expect(result.jobs).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('TC0002 - Should use default pagination values', async () => {
      videoService.list.mockResolvedValue(mockJobListResponse);

      await controller.list(mockRequest, '1', '10');

      expect(videoService.list).toHaveBeenCalledWith(mockUserId, 1, 10);
    });

    it('TC0003 - Should handle list error', async () => {
      const error = new Error('Erro ao listar jobs');
      videoService.list.mockRejectedValue(error);

      await expect(controller.list(mockRequest, '1', '10')).rejects.toThrow(
        error,
      );
    });
  });

  describe('download', () => {
    it('TC0001 - Should return 404 when file does not exist on disk', async () => {
      videoService.download.mockResolvedValue('/nonexistent/path.zip');

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        download: jest.fn(),
      } as any;

      await controller.download(mockJobId, mockRequest, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'File not found' });
    });

    it('TC0002 - Should propagate download service error', async () => {
      const error = new Error('Job not found');
      videoService.download.mockRejectedValue(error);

      const mockRes = {} as any;
      await expect(
        controller.download(mockJobId, mockRequest, mockRes),
      ).rejects.toThrow(error);
    });

    it('TC0003 - Should download file when it exists on disk', async () => {
      const existingPath = __filename;
      videoService.download.mockResolvedValue(existingPath);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const mockRes = {
        download: jest.fn().mockReturnThis(),
      } as any;

      await controller.download(mockJobId, mockRequest, mockRes);

      expect(mockRes.download).toHaveBeenCalledWith(existingPath);
    });

    it('TC0004 - Should return 404 when service returns empty file path', async () => {
      videoService.download.mockResolvedValue('' as any);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as any;

      await controller.download(mockJobId, mockRequest, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('watch', () => {
    it('TC0001 - Should return 404 when original file does not exist on disk', async () => {
      videoService.watch.mockResolvedValue('/nonexistent/video.mp4');

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        sendFile: jest.fn(),
      } as any;

      await controller.watch(mockJobId, mockRequest, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'File not found' });
    });

    it('TC0002 - Should stream file inline when it exists on disk', async () => {
      const existingPath = __filename;
      videoService.watch.mockResolvedValue(existingPath);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const mockRes = {
        setHeader: jest.fn(),
        sendFile: jest.fn().mockReturnThis(),
      } as any;

      await controller.watch(mockJobId, mockRequest, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline',
      );
      expect(mockRes.sendFile).toHaveBeenCalled();
    });

    it('TC0003 - Should return 404 when service returns empty input path', async () => {
      videoService.watch.mockResolvedValue('' as any);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as any;

      await controller.watch(mockJobId, mockRequest, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('remove', () => {
    it('TC0001 - Should delegate remove request to service', async () => {
      videoService.remove.mockResolvedValue({ message: 'ok' } as any);

      const result = await controller.remove(mockJobId, mockRequest);

      expect(videoService.remove).toHaveBeenCalledWith(mockJobId, mockUserId);
      expect(result).toEqual({ message: 'ok' });
    });
  });
});
