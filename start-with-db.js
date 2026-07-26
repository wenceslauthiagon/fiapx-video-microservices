'use strict';

const { spawnSync } = require('node:child_process');

const prismaArgs = ['prisma', 'db', 'push', '--skip-generate'];
const prismaCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('[Startup] Running Prisma schema sync...');
const result = spawnSync(prismaCmd, prismaArgs, { stdio: 'inherit' });

if (result.error) {
  console.error(`[Startup] Failed to run Prisma sync: ${result.error.message}`);
  process.exit(1);
}

if (typeof result.status === 'number' && result.status !== 0) {
  console.error(`[Startup] Prisma sync failed with exit code ${result.status}`);
  process.exit(result.status);
}

console.log('[Startup] Prisma schema synced. Starting API...');
require('./dist/main.js');
