/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.SMOKE_EMAIL || `smoke_${Date.now()}@test.local`;
const PASSWORD = process.env.SMOKE_PASSWORD || '123456';
const NAME = process.env.SMOKE_NAME || 'Smoke User';
const VIDEO_FILE = process.env.SMOKE_VIDEO_FILE || '';

async function assertOk(response, context) {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${context} failed (${response.status}): ${body}`);
  }
}

async function main() {
  console.log(`[smoke] API: ${API_BASE}`);

  const health = await fetch(`${API_BASE}/health`);
  await assertOk(health, 'health check');
  console.log('[smoke] health ok');

  const register = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: NAME,
      email: EMAIL,
      password: PASSWORD,
      confirmPassword: PASSWORD,
    }),
  });
  await assertOk(register, 'register');
  console.log('[smoke] register ok');

  const login = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
    }),
  });
  await assertOk(login, 'login');
  const loginBody = await login.json();
  const token = loginBody.access_token;
  if (!token) {
    throw new Error('login did not return access_token');
  }
  console.log('[smoke] login ok');

  if (VIDEO_FILE) {
    const absoluteVideoPath = path.resolve(VIDEO_FILE);
    if (!fs.existsSync(absoluteVideoPath)) {
      throw new Error(`video file not found: ${absoluteVideoPath}`);
    }

    const form = new FormData();
    const fileBuffer = fs.readFileSync(absoluteVideoPath);
    form.append(
      'file',
      new Blob([fileBuffer]),
      path.basename(absoluteVideoPath),
    );

    const upload = await fetch(`${API_BASE}/videos/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
    await assertOk(upload, 'upload');
    const uploadBody = await upload.json();
    console.log(`[smoke] upload ok jobId=${uploadBody.id}`);
  } else {
    console.log('[smoke] upload skipped (set SMOKE_VIDEO_FILE=path/to/video.mp4 to enable)');
  }

  const jobs = await fetch(`${API_BASE}/videos/jobs?page=1&limit=10`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await assertOk(jobs, 'list jobs');
  const jobsBody = await jobs.json();
  const count = Array.isArray(jobsBody.jobs) ? jobsBody.jobs.length : 0;
  console.log(`[smoke] jobs list ok total=${count}`);

  console.log('[smoke] SUCCESS');
}

main().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  if (message.includes('fetch failed')) {
    console.error(
      '[smoke] FAILED API indisponivel. Suba a stack primeiro: docker compose up -d --build api worker frontend',
    );
  } else {
    console.error('[smoke] FAILED', message);
  }
  process.exit(1);
});
