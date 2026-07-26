const { faker } = require('@faker-js/faker');
const { buildNotificationRecord } = require('./helpers');

describe('buildNotificationRecord', () => {
  it('TC0001 - Should return a complete notification record', () => {
    const id = faker.string.uuid();
    const jobId = faker.string.uuid();
    const type = 'COMPLETED';
    const message = faker.lorem.sentence();
    const createdAt = new Date();

    const result = buildNotificationRecord(id, jobId, type, message, createdAt);

    expect(result).toEqual({ id, jobId, type, message, sent: true, createdAt });
  });

  it('TC0002 - Should always set sent to true', () => {
    const result = buildNotificationRecord(
      faker.string.uuid(),
      faker.string.uuid(),
      'FAILED',
      faker.lorem.sentence(),
      new Date(),
    );
    expect(result.sent).toBe(true);
  });

  it('TC0003 - Should preserve the provided createdAt date', () => {
    const createdAt = new Date('2026-01-15T10:00:00Z');
    const result = buildNotificationRecord(
      faker.string.uuid(),
      faker.string.uuid(),
      'COMPLETED',
      'ok',
      createdAt,
    );
    expect(result.createdAt).toBe(createdAt);
  });

  it('TC0004 - Should preserve jobId reference', () => {
    const jobId = faker.string.uuid();
    const result = buildNotificationRecord(faker.string.uuid(), jobId, 'COMPLETED', 'ok', new Date());
    expect(result.jobId).toBe(jobId);
  });
});

