const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { createAccessToken, extractBearerToken, validateRegisterPayload } = require('./helpers');

let tracer = null;
if (process.env.DD_TRACE_ENABLED === 'true') {
  try {
    tracer = require('dd-trace').init({
      service: process.env.DD_SERVICE || 'fiapx-api-gateway',
      env: process.env.DD_ENV || 'dev',
      version: process.env.DD_VERSION || '1.0.0',
      logInjection: true,
      runtimeMetrics: true,
    });
    console.log('[observability] Datadog tracing enabled');
  } catch (err) {
    console.error('[observability] Failed to initialize Datadog tracer:', err.message);
  }
}

function getDatadogTraceContext() {
  if (!tracer?.scope) {
    return { traceId: null, spanId: null };
  }

  const span = tracer.scope().active();
  if (!span?.context) {
    return { traceId: null, spanId: null };
  }

  const context = span.context();
  return {
    traceId: context.toTraceId ? context.toTraceId() : null,
    spanId: context.toSpanId ? context.toSpanId() : null,
  };
}

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const DATABASE_URL = process.env.DATABASE_URL;
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const VIDEO_TOPIC = process.env.VIDEO_TOPIC || 'video.jobs';
const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
]);

const uploadBaseDir = process.env.UPLOAD_DIR || '/data/uploads';
const fallbackUploadBaseDir = path.join(os.tmpdir(), 'fiapx-uploads');

function ensureWritableDir(baseDir, fallbackDir) {
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    return baseDir;
  } catch (err) {
    if (!fallbackDir) throw err;
    fs.mkdirSync(fallbackDir, { recursive: true });
    return fallbackDir;
  }
}

const MAX_FILE_SIZE_MB = Number.parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);
function createUploadMiddleware(currentUploadDir, currentMaxFileSizeMb) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, currentUploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
  });

  return multer({
    storage,
    limits: { fileSize: currentMaxFileSizeMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_VIDEO_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'video'));
    },
  });
}

async function sendWithRetry(producer, params, attempts = 3, initialDelayMs = 300) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await producer.send(params);
      return;
    } catch (err) {
      lastError = err;
      if (i === attempts) break;
      const delay = initialDelayMs * (2 ** (i - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function createApp({ pool, producer, jwtSecret = JWT_SECRET, videoTopic = VIDEO_TOPIC, currentUploadDir = uploadBaseDir, currentMaxFileSizeMb = MAX_FILE_SIZE_MB }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  const writableUploadDir = ensureWritableDir(currentUploadDir, fallbackUploadBaseDir);

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    const requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const { traceId, spanId } = getDatadogTraceContext();

      console.log(
        '[observability] request',
        JSON.stringify({
          requestId,
          method: req.method,
          route: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          traceId,
          spanId,
          userAgent: req.headers['user-agent'] || null,
        }),
      );
    });

    next();
  });

  const upload = createUploadMiddleware(writableUploadDir, currentMaxFileSizeMb);

  function authMiddleware(req, res, next) {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ message: 'Token ausente' });
    try {
      req.user = jwt.verify(token, jwtSecret);
      next();
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(401).json({ message: 'Token invalido' });
    }
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api-gateway' });
  });

  app.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    if (!validateRegisterPayload(req.body)) return res.status(400).json({ message: 'Campos obrigatorios' });

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
        [id, email, passwordHash, name],
      );
      res.status(201).json({ id, email, name });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'Email ja cadastrado' });
      res.status(500).json({ message: 'Erro ao cadastrar usuario' });
    }
  });

  app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(401).json({ message: 'Credenciais invalidas' });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Credenciais invalidas' });

    const token = createAccessToken(
      { userId: user.id, email: user.email },
      jwtSecret,
      process.env.JWT_EXPIRATION || '7d',
    );
    res.json({ access_token: token });
  });

  app.post('/videos/upload', authMiddleware, upload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Arquivo de video obrigatorio' });

    const id = uuidv4();
    const now = new Date();

    await pool.query(
      `INSERT INTO video_jobs (id, user_id, original_file_name, status, input_path, created_at, updated_at)
       VALUES ($1, $2, $3, 'PENDING', $4, $5, $5)`,
      [id, req.user.userId, req.file.originalname, req.file.path, now],
    );

    await sendWithRetry(producer, {
      topic: videoTopic,
      messages: [{ value: JSON.stringify({ jobId: id, userId: req.user.userId }) }],
    });

    res.status(202).json({ jobId: id, status: 'PENDING' });
  });

  app.use((err, _req, res, next) => {
    if (!(err instanceof multer.MulterError)) {
      next(err);
      return;
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: `Arquivo excede o limite de ${currentMaxFileSizeMb}MB` });
      return;
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({ message: 'Formato invalido. Envie um arquivo de video suportado.' });
      return;
    }

    res.status(400).json({ message: 'Erro no upload do arquivo' });
  });

  app.get('/videos/jobs', authMiddleware, async (req, res) => {
    const result = await pool.query(
      `SELECT id, original_file_name, status, frame_count, error, created_at, updated_at
       FROM video_jobs WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId],
    );
    res.json({ jobs: result.rows });
  });

  app.get('/videos/jobs/:jobId', authMiddleware, async (req, res) => {
    const result = await pool.query(
      `SELECT id, user_id, original_file_name, status, frame_count, error, output_path, created_at, updated_at
       FROM video_jobs WHERE id = $1`,
      [req.params.jobId],
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Job nao encontrado' });

    const job = result.rows[0];
    if (job.user_id !== req.user.userId) return res.status(403).json({ message: 'Acesso negado' });

    res.json({
      id: job.id,
      originalFileName: job.original_file_name,
      status: job.status,
      frameCount: job.frame_count,
      error: job.error,
      outputPath: job.output_path,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    });
  });

  app.get('/videos/download/:jobId', authMiddleware, async (req, res) => {
    const result = await pool.query(
      'SELECT output_path, status, user_id FROM video_jobs WHERE id = $1',
      [req.params.jobId],
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Job nao encontrado' });

    const job = result.rows[0];
    if (job.user_id !== req.user.userId) return res.status(403).json({ message: 'Acesso negado' });
    if (job.status !== 'COMPLETED' || !job.output_path) return res.status(409).json({ message: 'Job ainda nao concluido' });
    if (!fs.existsSync(job.output_path)) return res.status(404).json({ message: 'Arquivo nao encontrado' });

    return res.download(job.output_path, path.basename(job.output_path));
  });

  app.post('/videos/retry/:jobId', authMiddleware, async (req, res) => {
    const { jobId } = req.params;

    const jobResult = await pool.query(
      'SELECT id, user_id, status FROM video_jobs WHERE id = $1',
      [jobId],
    );
    if (!jobResult.rows.length) return res.status(404).json({ message: 'Job nao encontrado' });

    const job = jobResult.rows[0];
    if (job.user_id !== req.user.userId) return res.status(403).json({ message: 'Acesso negado' });
    if (job.status !== 'FAILED') {
      return res.status(409).json({ message: 'Apenas jobs com falha podem ser reprocessados' });
    }

    await pool.query(
      `UPDATE video_jobs
       SET status = 'PENDING', error = NULL, output_path = NULL, frame_count = NULL, updated_at = $2
       WHERE id = $1`,
      [jobId, new Date()],
    );

    await sendWithRetry(producer, {
      topic: videoTopic,
      messages: [{ value: JSON.stringify({ jobId, userId: req.user.userId }) }],
    });

    return res.status(202).json({ jobId, status: 'PENDING', retried: true });
  });

  app.get('/notifications', authMiddleware, async (req, res) => {
    const result = await pool.query(
      `SELECT n.id, n.job_id, n.type, n.message, n.sent, n.created_at
       FROM notifications n
       JOIN video_jobs j ON j.id = n.job_id
       WHERE j.user_id = $1
       ORDER BY n.created_at DESC`,
      [req.user.userId],
    );
    res.json({ notifications: result.rows });
  });

  app.get('/metrics/jobs', authMiddleware, async (_req, res) => {
    const grouped = await pool.query(
      `SELECT status, COUNT(*)::int AS total
       FROM video_jobs
       GROUP BY status`,
    );

    const jobsByStatus = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    for (const row of grouped.rows) {
      jobsByStatus[row.status] = Number(row.total);
    }

    const totalJobs = Object.values(jobsByStatus).reduce((acc, value) => acc + value, 0);

    res.json({
      totalJobs,
      jobsByStatus,
      generatedAt: new Date().toISOString(),
    });
  });

  return app;
}

const pool = new Pool({ connectionString: DATABASE_URL });
const kafka = new Kafka({ clientId: 'api-gateway', brokers: KAFKA_BROKERS });
const producer = kafka.producer();
const app = createApp({ pool, producer });

async function start() {
  await producer.connect();
  app.listen(PORT, () => console.log(`api-gateway listening on ${PORT}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('failed to start api-gateway', err);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  sendWithRetry,
  start,
};
