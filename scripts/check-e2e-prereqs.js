/* eslint-disable no-console */
const net = require('node:net');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.test' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[e2e:precheck] DATABASE_URL nao definido em .env.test');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error('[e2e:precheck] DATABASE_URL invalido em .env.test');
  process.exit(1);
}

const host = parsedUrl.hostname;
const port = Number(parsedUrl.port || 5432);

const socket = new net.Socket();
socket.setTimeout(2500);

function fail(message) {
  console.error(`[e2e:precheck] ${message}`);
  console.error(
    '[e2e:precheck] Suba o banco antes do e2e: docker compose up -d postgres',
  );
  socket.destroy();
  process.exit(1);
}

socket.on('connect', () => {
  console.log(`[e2e:precheck] PostgreSQL acessivel em ${host}:${port}`);
  socket.end();
  process.exit(0);
});

socket.on('timeout', () => fail(`Timeout conectando em ${host}:${port}`));
socket.on('error', () => fail(`Nao foi possivel conectar em ${host}:${port}`));

socket.connect(port, host);
