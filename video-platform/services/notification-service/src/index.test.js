const { faker } = require('@faker-js/faker');
const { retryAsync, processMessage, createService } = require('./index');

describe('notification-service retryAsync', () => {
  it('TC0001 - Should resolve on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryAsync(fn, 3, 1);
    expect(result).toBe('ok');
  });

  it('TC0002 - Should retry then succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValue('ok');
    const result = await retryAsync(fn, 2, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('TC0003 - Should throw after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(retryAsync(fn, 2, 1)).rejects.toThrow('boom');
  });
});

describe('notification-service processMessage', () => {
  it('TC0001 - Should ignore invalid JSON', async () => {
    const pool = { query: jest.fn() };
    const transporter = { sendMail: jest.fn() };

    await processMessage({ value: Buffer.from('invalid-json') }, { pool, transporter });

    expect(pool.query).not.toHaveBeenCalled();
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  it('TC0002 - Should ignore event missing required fields', async () => {
    const pool = { query: jest.fn() };
    const transporter = { sendMail: jest.fn() };

    await processMessage({ value: Buffer.from(JSON.stringify({ jobId: faker.string.uuid() })) }, { pool, transporter });

    expect(pool.query).not.toHaveBeenCalled();
  });

  it('TC0003 - Should persist notification and skip email when user email is not found', async () => {
    const event = {
      jobId: faker.string.uuid(),
      type: 'SUCCESS',
      message: 'ok',
      userId: faker.string.uuid(),
    };

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };
    const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };

    await processMessage({ value: Buffer.from(JSON.stringify(event)) }, { pool, transporter });

    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  it('TC0004 - Should persist notification and send email when user email exists', async () => {
    const event = {
      jobId: faker.string.uuid(),
      type: 'FAILED',
      message: 'erro',
      userId: faker.string.uuid(),
    };

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ email: faker.internet.email() }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };
    const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };

    await processMessage({ value: Buffer.from(JSON.stringify(event)) }, { pool, transporter, smtpFrom: 'noreply@test.com' });

    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  });

  it('TC0005 - Should persist notification even if user email query fails', async () => {
    const event = {
      jobId: faker.string.uuid(),
      type: 'SUCCESS',
      message: 'ok',
      userId: faker.string.uuid(),
    };

    const pool = {
      query: jest
        .fn()
        .mockRejectedValueOnce(new Error('db read fail'))
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };
    const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };

    await processMessage({ value: Buffer.from(JSON.stringify(event)) }, { pool, transporter });

    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  it('TC0006 - Should swallow email send failure', async () => {
    const event = {
      jobId: faker.string.uuid(),
      type: 'FAILED',
      message: 'erro',
      userId: faker.string.uuid(),
    };

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ email: faker.internet.email() }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };
    const transporter = { sendMail: jest.fn().mockRejectedValue(new Error('smtp down')) };

    await expect(processMessage(
      { value: Buffer.from(JSON.stringify(event)) },
      { pool, transporter, smtpFrom: 'noreply@test.com' },
    )).resolves.toBeUndefined();

    expect(transporter.sendMail).toHaveBeenCalledTimes(3);
  });

  it('TC0007 - Should skip duplicate notification and not send email', async () => {
    const event = {
      jobId: faker.string.uuid(),
      type: 'SUCCESS',
      message: 'ja notificado',
      userId: faker.string.uuid(),
    };

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ email: faker.internet.email() }] })
        .mockResolvedValueOnce({ rows: [{ id: faker.string.uuid() }] }),
    };
    const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };

    await processMessage({ value: Buffer.from(JSON.stringify(event)) }, { pool, transporter });

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });
});

describe('notification-service createService', () => {
  it('TC0001 - Should wire connect/subscribe/run on start', async () => {
    const pool = { query: jest.fn() };
    const transporter = { sendMail: jest.fn().mockResolvedValue(undefined) };
    const consumer = {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
    };

    const service = createService({
      pool,
      consumer,
      transporter,
      notificationTopic: 'video.notifications',
    });

    await service.start();

    expect(consumer.connect).toHaveBeenCalledTimes(1);
    expect(consumer.subscribe).toHaveBeenCalledWith({ topic: 'video.notifications', fromBeginning: false });
    expect(consumer.run).toHaveBeenCalledTimes(1);
  });
});
