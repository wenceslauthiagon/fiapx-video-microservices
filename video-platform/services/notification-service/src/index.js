const { v4: uuidv4 } = require('uuid');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { buildNotificationRecord } = require('./helpers');

const DATABASE_URL = process.env.DATABASE_URL;
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const NOTIFICATION_TOPIC = process.env.NOTIFICATION_TOPIC || 'video.notifications';
const SMTP_HOST = process.env.SMTP_HOST || 'mailhog';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '1025', 10);
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@fiapx.com';

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

async function processMessage(message, { pool, transporter, smtpFrom = SMTP_FROM }) {
  if (!message.value) return;
  let event;
  try {
    event = JSON.parse(message.value.toString());
  } catch (err) {
    console.error('invalid Kafka notification payload', err.message);
    return;
  }

  if (!event.jobId || !event.type || !event.message) {
    console.error('discarded notification event missing required fields');
    return;
  }

  let userEmail = null;
  try {
    const query = event.userId
      ? 'SELECT email FROM users WHERE id = $1'
      : 'SELECT u.email FROM users u JOIN video_jobs j ON j.user_id = u.id WHERE j.id = $1';
    const param = event.userId ?? event.jobId;
    const userRow = await pool.query(query, [param]);
    if (userRow.rows.length) userEmail = userRow.rows[0].email;
  } catch (err) {
    console.error('failed to fetch user email:', err.message);
  }

  const record = buildNotificationRecord(uuidv4(), event.jobId, event.type, event.message, new Date());

  const duplicateCheck = await pool.query(
    `SELECT id FROM notifications
     WHERE job_id = $1 AND type = $2 AND message = $3
     LIMIT 1`,
    [event.jobId, event.type, event.message],
  );

  if (duplicateCheck.rows.length) {
    console.log(`notification duplicate skipped for job ${event.jobId} (${event.type})`);
    return;
  }

  await pool.query(
    `INSERT INTO notifications (id, job_id, type, message, sent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [record.id, record.jobId, record.type, record.message, record.sent, record.createdAt],
  );

  console.log(`notification persisted for job ${event.jobId} (${event.type})`);

  if (userEmail) {
    const isSuccess = event.type === 'SUCCESS';
    await retryAsync(() => transporter.sendMail({
      from: smtpFrom,
      to: userEmail,
      subject: isSuccess ? 'Seu video foi processado' : 'Erro ao processar video',
      text: event.message,
      html: `<p>${event.message}</p><p><small>Job ID: ${event.jobId}</small></p>`,
    })).catch((err) => console.error('failed to send email:', err.message));
  }
}

function createService({ pool, consumer, transporter, notificationTopic = NOTIFICATION_TOPIC }) {
  async function start() {
    await consumer.connect();
    await consumer.subscribe({ topic: notificationTopic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        await processMessage(message, { pool, transporter });
      },
    });

    console.log('notification-service listening Kafka topic', notificationTopic);
  }

  return { start };
}

const pool = new Pool({ connectionString: DATABASE_URL });
const kafka = new Kafka({ clientId: 'notification-service', brokers: KAFKA_BROKERS });
const consumer = kafka.consumer({ groupId: 'video-notifications-group' });
const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false });

const service = createService({ pool, consumer, transporter });

if (require.main === module) {
  service.start().catch((err) => {
    console.error('failed to start notification-service', err);
    process.exit(1);
  });
}

module.exports = {
  retryAsync,
  processMessage,
  createService,
};
