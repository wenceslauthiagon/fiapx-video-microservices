const { faker } = require('@faker-js/faker');
const os = require('node:os');
const path = require('node:path');
const { retryAsync, processMessage, handleJob, createService } = require('./index');

const safeOutputBaseDir = path.join(os.tmpdir(), 'fiapx-worker-test-output');
const safeInputPath = path.join(os.tmpdir(), 'fiapx-worker-test-input.mp4');

describe('processing-worker retryAsync', () => {
  it('TC0001 - Should resolve on first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryAsync(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('TC0002 - Should retry and then succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('ok');

    const result = await retryAsync(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('TC0003 - Should throw after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(retryAsync(fn, 2, 1)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('processing-worker processMessage', () => {
  it('TC0001 - Should ignore invalid JSON payload', async () => {
    const pool = { query: jest.fn() };
    const producer = { send: jest.fn() };
    await processMessage({ value: Buffer.from('invalid-json') }, {
      pool,
      producer,
      currentOutputBaseDir: safeOutputBaseDir,
      notificationTopic: 'video.notifications',
    });
    expect(pool.query).not.toHaveBeenCalled();
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('TC0002 - Should ignore payload without jobId', async () => {
    const pool = { query: jest.fn() };
    const producer = { send: jest.fn() };
    await processMessage({ value: Buffer.from(JSON.stringify({ userId: faker.string.uuid() })) }, {
      pool,
      producer,
      currentOutputBaseDir: safeOutputBaseDir,
      notificationTopic: 'video.notifications',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('TC0003 - Should mark job as failed and publish FAILED notification when job is missing', async () => {
    const jobId = faker.string.uuid();
    const userId = faker.string.uuid();

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };
    const producer = { send: jest.fn().mockResolvedValue(undefined) };

    await processMessage({ value: Buffer.from(JSON.stringify({ jobId, userId })) }, {
      pool,
      producer,
      currentOutputBaseDir: safeOutputBaseDir,
      notificationTopic: 'video.notifications',
    });

    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(producer.send).toHaveBeenCalledTimes(1);
    const sentPayload = JSON.parse(producer.send.mock.calls[0][0].messages[0].value);
    expect(sentPayload.jobId).toBe(jobId);
    expect(sentPayload.type).toBe('FAILED');
    expect(sentPayload.userId).toBe(userId);
  });
});

describe('processing-worker handleJob', () => {
  it('TC0001 - Should process job, update DB and publish SUCCESS notification', async () => {
    const jobId = faker.string.uuid();
    const userId = faker.string.uuid();

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ input_path: safeInputPath }] })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };
    const producer = { send: jest.fn().mockResolvedValue(undefined) };

    const fakeOutputStream = {
      on: jest.fn((event, cb) => {
        if (event === 'close') cb();
      }),
    };

    const fakeArchive = {
      on: jest.fn(),
      pipe: jest.fn(),
      directory: jest.fn(),
      finalize: jest.fn(),
    };

    const fsModule = {
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      readdirSync: jest.fn().mockReturnValue(['0001.jpg', '0002.jpg']),
      createWriteStream: jest.fn().mockReturnValue(fakeOutputStream),
      rmSync: jest.fn(),
    };

    const execCommand = jest.fn();
    const archiverFactory = jest.fn().mockReturnValue(fakeArchive);
    const pathModule = { join: jest.fn((_base, suffix) => path.join(safeOutputBaseDir, suffix)) };

    await handleJob(
      { jobId, userId },
      {
        pool,
        producer,
        currentOutputBaseDir: safeOutputBaseDir,
        notificationTopic: 'video.notifications',
      },
      { fsModule, execCommand, archiverFactory, pathModule },
    );

    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(producer.send).toHaveBeenCalledTimes(1);
    const sentPayload = JSON.parse(producer.send.mock.calls[0][0].messages[0].value);
    expect(sentPayload.type).toBe('SUCCESS');
    expect(sentPayload.userId).toBe(userId);
    expect(fsModule.existsSync).toHaveBeenCalledWith(safeInputPath);
    expect(fsModule.rmSync).toHaveBeenCalledTimes(1);
  });

  it('TC0002 - Should skip non-pending jobs without publishing', async () => {
    const jobId = faker.string.uuid();
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ status: 'COMPLETED' }] }),
    };
    const producer = { send: jest.fn() };

    const fsModule = {
      existsSync: jest.fn(),
      mkdirSync: jest.fn(),
      readdirSync: jest.fn(),
      createWriteStream: jest.fn(),
      rmSync: jest.fn(),
    };

    await handleJob(
      { jobId, userId: faker.string.uuid() },
      {
        pool,
        producer,
        currentOutputBaseDir: safeOutputBaseDir,
        notificationTopic: 'video.notifications',
      },
      { fsModule, execCommand: jest.fn(), archiverFactory: jest.fn(), pathModule: path },
    );

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(producer.send).not.toHaveBeenCalled();
    expect(fsModule.mkdirSync).not.toHaveBeenCalled();
  });
});

describe('processing-worker createService', () => {
  it('TC0001 - Should wire connect/subscribe/run on start', async () => {
    const pool = { query: jest.fn() };
    const producer = {
      connect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
    };
    const consumer = {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
    };

    const service = createService({
      pool,
      producer,
      consumer,
      currentOutputBaseDir: safeOutputBaseDir,
      videoTopic: 'video.jobs',
      notificationTopic: 'video.notifications',
    });

    await service.start();

    expect(producer.connect).toHaveBeenCalledTimes(1);
    expect(consumer.connect).toHaveBeenCalledTimes(1);
    expect(consumer.subscribe).toHaveBeenCalledWith({ topic: 'video.jobs', fromBeginning: false });
    expect(consumer.run).toHaveBeenCalledTimes(1);
  });
});
