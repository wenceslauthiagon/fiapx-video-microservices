import { faker } from '@faker-js/faker/locale/pt_BR';

import { User } from '../../../src/domain/entities/user.entity';
import {
  VideoJob,
  JobStatus,
} from '../../../src/domain/entities/video-job.entity';

describe('User entity', () => {
  const userId = faker.string.uuid();
  const mockEmail = faker.internet.email();
  const mockName = faker.person.fullName();
  const mockPassword = faker.internet.password({ length: 8 });

  it('TC0001 - Should instantiate with correct properties', () => {
    const user = new User(userId, mockEmail, mockPassword, mockName);

    expect(user.id).toBe(userId);
    expect(user.email).toBe(mockEmail);
    expect(user.name).toBe(mockName);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('TC0002 - Should validate a correct email', () => {
    const user = new User(userId, mockEmail, mockPassword, mockName);
    expect(user.isValidEmail()).toBe(true);
  });

  it('TC0003 - Should reject an invalid email', () => {
    const user = new User(userId, 'not-an-email', mockPassword, mockName);
    expect(user.isValidEmail()).toBe(false);
  });
});

describe('VideoJob entity', () => {
  const jobId = faker.string.uuid();
  const userId = faker.string.uuid();

  it('TC0001 - Should instantiate with PENDING status and zero progress', () => {
    const job = new VideoJob(jobId, userId, 'video.mp4', '/uploads/video.mp4');

    expect(job.id).toBe(jobId);
    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.progress).toBe(0);
    expect(job.createdAt).toBeInstanceOf(Date);
  });

  it('TC0002 - Should not be downloadable when PENDING', () => {
    const job = new VideoJob(jobId, userId, 'video.mp4', '/uploads/video.mp4');
    expect(job.isDownloadable()).toBe(false);
  });

  it('TC0003 - Should not be downloadable when COMPLETED but no outputPath', () => {
    const job = new VideoJob(jobId, userId, 'video.mp4', '/uploads/video.mp4');
    job.status = JobStatus.COMPLETED;
    expect(job.isDownloadable()).toBe(false);
  });

  it('TC0004 - Should be downloadable when COMPLETED with outputPath', () => {
    const job = new VideoJob(jobId, userId, 'video.mp4', '/uploads/video.mp4');
    job.status = JobStatus.COMPLETED;
    job.outputPath = '/outputs/video.zip';
    expect(job.isDownloadable()).toBe(true);
  });

  it('TC0005 - Should not be downloadable when FAILED', () => {
    const job = new VideoJob(jobId, userId, 'video.mp4', '/uploads/video.mp4');
    job.status = JobStatus.FAILED;
    job.outputPath = '/outputs/video.zip';
    expect(job.isDownloadable()).toBe(false);
  });
});
