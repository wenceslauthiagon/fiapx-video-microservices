const { faker } = require('@faker-js/faker');
const path = require('node:path');
const { buildOutputPath, buildNotificationEvent } = require('./helpers');

describe('buildOutputPath', () => {
  it('TC0001 - Should build a .zip path from base dir and jobId', () => {
    const baseDir = '/data/outputs';
    const jobId = faker.string.uuid();
    const result = buildOutputPath(baseDir, jobId);
    expect(result).toBe(path.join(baseDir, `${jobId}.zip`));
  });

  it('TC0002 - Should include the jobId in the filename', () => {
    const jobId = faker.string.uuid();
    const result = buildOutputPath('/outputs', jobId);
    expect(result).toContain(jobId);
  });

  it('TC0003 - Should always end with .zip extension', () => {
    const result = buildOutputPath('/outputs', faker.string.uuid());
    expect(result.endsWith('.zip')).toBe(true);
  });
});

describe('buildNotificationEvent', () => {
  it('TC0001 - Should return an object with jobId, type and message', () => {
    const jobId = faker.string.uuid();
    const type = 'COMPLETED';
    const message = faker.lorem.sentence();
    const result = buildNotificationEvent(jobId, type, message);
    expect(result).toEqual({ jobId, type, message });
  });

  it('TC0002 - Should preserve all provided values unchanged', () => {
    const jobId = faker.string.uuid();
    const result = buildNotificationEvent(jobId, 'FAILED', 'err');
    expect(result.jobId).toBe(jobId);
    expect(result.type).toBe('FAILED');
    expect(result.message).toBe('err');
  });
});

