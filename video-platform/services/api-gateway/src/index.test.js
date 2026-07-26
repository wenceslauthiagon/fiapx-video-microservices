const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');

const { createApp, sendWithRetry } = require('./index');

describe('api-gateway http', () => {
  const jwtSecret = faker.string.alphanumeric(32);
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiapx-upload-'));
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiapx-download-'));
  const simulatedOutputPath = path.join(downloadDir, 'simulated-out.zip');
  const simulatedMissingPath = path.join(downloadDir, 'absent.zip');

  const pool = {
    query: jest.fn(),
  };

  const producer = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const app = createApp({
    pool,
    producer,
    jwtSecret,
    videoTopic: 'video.jobs',
    currentUploadDir: uploadDir,
    currentMaxFileSizeMb: 1,
  });

  const userId = faker.string.uuid();
  const token = jwt.sign({ userId, email: faker.internet.email() }, jwtSecret);

  beforeEach(() => {
    pool.query.mockReset();
    producer.send.mockClear();
  });

  afterAll(() => {
    fs.rmSync(uploadDir, { recursive: true, force: true });
    fs.rmSync(downloadDir, { recursive: true, force: true });
  });

  it('TC0001 - GET /health returns service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-gateway' });
  });

  it('TC0002 - POST /auth/register validates required payload', async () => {
    const res = await request(app).post('/auth/register').send({ email: faker.internet.email() });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Campos obrigatorios');
  });

  it('TC0003 - POST /auth/register creates user', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });

    const payload = {
      email: faker.internet.email(),
      password: faker.internet.password(),
      name: faker.person.fullName(),
    };

    const res = await request(app).post('/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(payload.email);
    expect(res.body.name).toBe(payload.name);
  });

  it('TC0004 - POST /auth/register returns 409 for duplicated email', async () => {
    pool.query.mockRejectedValue({ code: '23505' });

    const res = await request(app).post('/auth/register').send({
      email: faker.internet.email(),
      password: faker.internet.password(),
      name: faker.person.fullName(),
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email ja cadastrado');
  });

  it('TC0005 - POST /auth/register returns 500 for unknown DB error', async () => {
    pool.query.mockRejectedValue(new Error('db')); 

    const res = await request(app).post('/auth/register').send({
      email: faker.internet.email(),
      password: faker.internet.password(),
      name: faker.person.fullName(),
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erro ao cadastrar usuario');
  });

  it('TC0006 - POST /auth/login returns 401 when user is missing', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app).post('/auth/login').send({
      email: faker.internet.email(),
      password: faker.internet.password(),
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciais invalidas');
  });

  it('TC0007 - POST /auth/login returns 401 for invalid password', async () => {
    const password = faker.internet.password();
    const wrongHash = await bcrypt.hash('another-password', 10);
    pool.query.mockResolvedValue({ rows: [{ id: userId, email: faker.internet.email(), password: wrongHash }] });

    const res = await request(app).post('/auth/login').send({
      email: faker.internet.email(),
      password,
    });

    expect(res.status).toBe(401);
  });

  it('TC0008 - POST /auth/login returns token for valid credentials', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();
    const hash = await bcrypt.hash(password, 10);
    pool.query.mockResolvedValue({ rows: [{ id: userId, email, password: hash }] });

    const res = await request(app).post('/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(typeof res.body.access_token).toBe('string');
  });

  it('TC0009 - GET /videos/jobs requires auth token', async () => {
    const res = await request(app).get('/videos/jobs');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token ausente');
  });

  it('TC0010 - GET /videos/jobs returns jobs list', async () => {
    const jobs = [{ id: faker.string.uuid(), status: 'PENDING' }];
    pool.query.mockResolvedValue({ rows: jobs });

    const res = await request(app)
      .get('/videos/jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toEqual(jobs);
  });

  it('TC0011 - GET /videos/jobs/:jobId returns 404 when job does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get(`/videos/jobs/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Job nao encontrado');
  });

  it('TC0012 - GET /videos/jobs/:jobId returns 403 for another user', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: faker.string.uuid(), user_id: faker.string.uuid() }] });

    const res = await request(app)
      .get(`/videos/jobs/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Acesso negado');
  });

  it('TC0013 - GET /videos/jobs/:jobId returns mapped payload for owner', async () => {
    const row = {
      id: faker.string.uuid(),
      user_id: userId,
      original_file_name: 'video.mp4',
      status: 'COMPLETED',
      frame_count: 3,
      error: null,
      output_path: simulatedOutputPath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    pool.query.mockResolvedValue({ rows: [row] });

    const res = await request(app)
      .get(`/videos/jobs/${row.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(row.id);
    expect(res.body.originalFileName).toBe('video.mp4');
  });

  it('TC0014 - GET /notifications returns list for authenticated user', async () => {
    const notifications = [{
      id: faker.string.uuid(),
      job_id: faker.string.uuid(),
      type: 'SUCCESS',
      message: 'ok',
      sent: true,
      created_at: new Date().toISOString(),
    }];
    pool.query.mockResolvedValue({ rows: notifications });

    const res = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual(notifications);
  });

  it('TC0015 - POST /videos/upload rejects non-video file', async () => {
    const res = await request(app)
      .post('/videos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('video', Buffer.from('not-video-content'), { filename: 'file.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Formato invalido. Envie um arquivo de video suportado.');
  });

  it('TC0016 - POST /videos/upload accepts valid video file and publishes job', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app)
      .post('/videos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('video', Buffer.from('fake-video-content'), { filename: 'video.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('PENDING');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(producer.send).toHaveBeenCalledTimes(1);
  });

  it('TC0017 - GET /videos/download/:jobId returns 404 when missing', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get(`/videos/download/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Job nao encontrado');
  });

  it('TC0018 - GET /videos/download/:jobId returns 403 for another user', async () => {
    pool.query.mockResolvedValue({ rows: [{ output_path: simulatedOutputPath, status: 'COMPLETED', user_id: faker.string.uuid() }] });

    const res = await request(app)
      .get(`/videos/download/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('TC0019 - GET /videos/download/:jobId returns 409 when not completed', async () => {
    pool.query.mockResolvedValue({ rows: [{ output_path: null, status: 'PROCESSING', user_id: userId }] });

    const res = await request(app)
      .get(`/videos/download/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('TC0020 - GET /videos/download/:jobId returns 404 when file path is absent on disk', async () => {
    pool.query.mockResolvedValue({ rows: [{ output_path: simulatedMissingPath, status: 'COMPLETED', user_id: userId }] });

    const res = await request(app)
      .get(`/videos/download/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Arquivo nao encontrado');
  });

  it('TC0021 - GET /videos/download/:jobId downloads when file exists', async () => {
    const zipPath = path.join(downloadDir, `${faker.string.uuid()}.zip`);
    fs.writeFileSync(zipPath, 'zip-content');
    pool.query.mockResolvedValue({ rows: [{ output_path: zipPath, status: 'COMPLETED', user_id: userId }] });

    const res = await request(app)
      .get(`/videos/download/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain(path.basename(zipPath));
  });

  it('TC0022 - POST /videos/retry/:jobId returns 404 when job does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/videos/retry/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Job nao encontrado');
  });

  it('TC0023 - POST /videos/retry/:jobId returns 403 for another user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: faker.string.uuid(), user_id: faker.string.uuid(), status: 'FAILED' }] });

    const res = await request(app)
      .post(`/videos/retry/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Acesso negado');
  });

  it('TC0024 - POST /videos/retry/:jobId returns 409 for non-failed job', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: faker.string.uuid(), user_id: userId, status: 'COMPLETED' }] });

    const res = await request(app)
      .post(`/videos/retry/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Apenas jobs com falha podem ser reprocessados');
  });

  it('TC0025 - POST /videos/retry/:jobId requeues failed job', async () => {
    const retryJobId = faker.string.uuid();
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: retryJobId, user_id: userId, status: 'FAILED' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .post(`/videos/retry/${retryJobId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ jobId: retryJobId, status: 'PENDING', retried: true });
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(producer.send).toHaveBeenCalledTimes(1);
  });

  it('TC0026 - GET /metrics/jobs requires auth token', async () => {
    const res = await request(app).get('/metrics/jobs');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token ausente');
  });

  it('TC0027 - GET /metrics/jobs returns aggregated counts by status', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { status: 'PENDING', total: 2 },
        { status: 'PROCESSING', total: 1 },
        { status: 'COMPLETED', total: 4 },
      ],
    });

    const res = await request(app)
      .get('/metrics/jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalJobs).toBe(7);
    expect(res.body.jobsByStatus).toEqual({
      PENDING: 2,
      PROCESSING: 1,
      COMPLETED: 4,
      FAILED: 0,
      CANCELLED: 0,
    });
    expect(typeof res.body.generatedAt).toBe('string');
  });
});

describe('api-gateway sendWithRetry', () => {
  it('TC0001 - Should retry and then succeed', async () => {
    const producer = {
      send: jest
        .fn()
        .mockRejectedValueOnce(new Error('first'))
        .mockResolvedValue(undefined),
    };

    await sendWithRetry(producer, { topic: 'video.jobs', messages: [{ value: '{}' }] }, 2, 1);

    expect(producer.send).toHaveBeenCalledTimes(2);
  });

  it('TC0002 - Should throw after max retries', async () => {
    const producer = { send: jest.fn().mockRejectedValue(new Error('kafka down')) };
    await expect(sendWithRetry(producer, { topic: 'video.jobs', messages: [{ value: '{}' }] }, 2, 1))
      .rejects.toThrow('kafka down');
  });
});
