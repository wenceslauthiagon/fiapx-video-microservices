# Quickstart

## Pre-requisitos

- Docker e Docker Compose
- Node.js 22 para execucao fora de container
- npm

## Subida em 3 minutos

```bash
docker compose up -d postgres redis mailhog prometheus grafana
docker compose up -d --build api worker frontend
```

Frontend:

```text
http://localhost:4173
```

## Validacao rapida

```bash
curl http://localhost:3001/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "service": "fiapx-api"
}
```

Swagger:

```text
http://localhost:3001/api-doc
```

## Fluxo de teste manual

### 1. Registrar usuario

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "123456",
    "confirmPassword": "123456",
    "name": "John Doe"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "123456"
  }'
```

Guarde o valor de access_token em TOKEN.

### 3. Upload

```bash
curl -X POST http://localhost:3001/videos/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./sample.mp4"
```

### 4. Consultar jobs

```bash
curl -X GET "http://localhost:3001/videos/jobs?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Download

```bash
curl -X GET http://localhost:3001/videos/download/<JOB_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -o processed-frames.zip
```

### 6. Verificar email

Abra:

```text
http://localhost:8025
```

## Logs uteis

```bash
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f frontend
```

## Testes de validacao (banca)

```bash
npm install
npm run db:generate
npm run test
npm run test:e2e
```

Smoke test rapido:

```bash
npm run smoke:test
```

Smoke test com upload:

Linux/macOS:

```bash
SMOKE_VIDEO_FILE=./sample.mp4 npm run smoke:test
```

Windows PowerShell:

```powershell
$env:SMOKE_VIDEO_FILE="./sample.mp4"; npm run smoke:test
```

## Limpeza

```bash
docker compose down
docker compose down -v
```

## Execucao sem Docker

```bash
npm install
npm run db:generate
npm run db:push
npm run start:api
npm run start:worker
```

## Troubleshooting rapido

1. `docker compose` falha com `dockerDesktopLinuxEngine`:
Inicie o Docker Desktop e tente novamente.

2. `npm run test:e2e` falha com erro de banco:
Verifique se o PostgreSQL esta ativo na porta esperada do `.env.test` (padrao `localhost:5436`).

3. Porta ocupada:
Altere portas de bind no `docker-compose.yml` ou finalize processo usando a porta.
