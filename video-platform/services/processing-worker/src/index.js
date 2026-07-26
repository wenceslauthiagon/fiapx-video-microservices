const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const archiver = require('archiver');
const { buildNotificationEvent, buildOutputPath } = require('./helpers');

const DATABASE_URL = process.env.DATABASE_URL;
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const VIDEO_TOPIC = process.env.VIDEO_TOPIC || 'video.jobs';
const NOTIFICATION_TOPIC = process.env.NOTIFICATION_TOPIC || 'video.notifications';

const outputBaseDir = process.env.OUTPUT_DIR || '/data/outputs';
const fallbackOutputBaseDir = path.join(os.tmpdir(), 'fiapx-outputs');

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

async function retryAsync(fn, attempts = 3, initialDelayMs = 300) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === attempts) break;
      const delay = initialDelayMs * (2 ** (i - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function handleJob(
  payload,
  { pool, producer, currentOutputBaseDir, notificationTopic },
  {
    fsModule = fs,
    execCommand = execSync,
    archiverFactory = archiver,
    pathModule = path,
  } = {},
) {
  const { jobId } = payload;
  const userId = payload.userId;

  const claimResult = await pool.query(
    "UPDATE video_jobs SET status = 'PROCESSING', updated_at = $2 WHERE id = $1 AND status = 'PENDING' RETURNING input_path",
    [jobId, new Date()],
  );

  if (!claimResult.rows.length) {
    const statusResult = await pool.query('SELECT status FROM video_jobs WHERE id = $1', [jobId]);
    if (!statusResult.rows.length) {
      throw new Error(`Job ${jobId} not found in DB`);
    }

    console.log(`job ${jobId} skipped (status ${statusResult.rows[0].status})`);
    return;
  }

  const inputPath = claimResult.rows[0].input_path;
  if (!fsModule.existsSync(inputPath)) {
    throw new Error('Input file not found');
  }

  const framesDir = pathModule.join(currentOutputBaseDir, `${jobId}_frames`);
  fsModule.mkdirSync(framesDir, { recursive: true });

  execCommand(
    `ffmpeg -i "${inputPath}" -vf fps=1 "${framesDir}/%04d.jpg" -y`,
    { stdio: 'pipe' },
  );

  const frameFiles = fsModule.readdirSync(framesDir).filter((f) => f.endsWith('.jpg'));
  const frameCount = frameFiles.length;

  const zipPath = buildOutputPath(currentOutputBaseDir, jobId);
  await new Promise((resolve, reject) => {
    const output = fsModule.createWriteStream(zipPath);
    const archive = archiverFactory('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(framesDir, false);
    archive.finalize();
  });

  fsModule.rmSync(framesDir, { recursive: true, force: true });

  await pool.query(
    "UPDATE video_jobs SET status = 'COMPLETED', frame_count = $2, output_path = $3, updated_at = $4 WHERE id = $1",
    [jobId, frameCount, zipPath, new Date()],
  );

  await retryAsync(() => producer.send({
    topic: notificationTopic,
    messages: [{
      value: JSON.stringify({
        ...buildNotificationEvent(jobId, 'SUCCESS', `Video processado com sucesso. ${frameCount} frame(s) extraido(s).`),
        userId,
      }),
    }],
  }));

  console.log(`job ${jobId} completed`);
}

async function processMessage(message, { pool, producer, currentOutputBaseDir, notificationTopic }) {
  if (!message.value) return;
  let payload;
  try {
    payload = JSON.parse(message.value.toString());
  } catch (err) {
    console.error('invalid Kafka message payload for video job', err.message);
    return;
  }

  if (!payload.jobId) {
    console.error('discarded Kafka message without jobId');
    return;
  }

  try {
    await handleJob(payload, { pool, producer, currentOutputBaseDir, notificationTopic });
  } catch (err) {
    await pool.query(
      "UPDATE video_jobs SET status = 'FAILED', error = $2, updated_at = $3 WHERE id = $1",
      [payload.jobId, err.message, new Date()],
    );

    await retryAsync(() => producer.send({
      topic: notificationTopic,
      messages: [{
        value: JSON.stringify({
          ...buildNotificationEvent(payload.jobId, 'FAILED', err.message),
          userId: payload.userId,
        }),
      }],
    }));

    console.error('job failed', payload.jobId, err);
  }
}

function createService({ pool, producer, consumer, currentOutputBaseDir = outputBaseDir, videoTopic = VIDEO_TOPIC, notificationTopic = NOTIFICATION_TOPIC }) {
  async function start() {
    const writableOutputBaseDir = ensureWritableDir(currentOutputBaseDir, fallbackOutputBaseDir);
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: videoTopic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        await processMessage(message, { pool, producer, currentOutputBaseDir: writableOutputBaseDir, notificationTopic });
      },
    });

    console.log('processing-worker listening Kafka topic', videoTopic);
  }

  return { start };
}

const pool = new Pool({ connectionString: DATABASE_URL });
const kafka = new Kafka({ clientId: 'processing-worker', brokers: KAFKA_BROKERS });
const consumer = kafka.consumer({ groupId: 'video-jobs-group' });
const producer = kafka.producer();

const service = createService({ pool, producer, consumer });

if (require.main === module) {
  service.start().catch((err) => {
    console.error('failed to start processing-worker', err);
    process.exit(1);
  });
}

module.exports = {
  retryAsync,
  processMessage,
  handleJob,
  createService,
};
