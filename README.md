# FIAP X Video Processor

Sistema de processamento de videos construido com NestJS, PostgreSQL, Redis e worker dedicado para execucao assíncrona via fila.

## Visao Geral

O projeto roda hoje a partir da raiz do repositorio, sem monorepo de apps separados. A solucao contem:

- API NestJS para autenticacao, upload, listagem e download
- Worker dedicado para consumo da fila e processamento com FFmpeg
- PostgreSQL para persistencia
- Redis para fila Bull
- MailHog para inspecao de emails em desenvolvimento
- Prometheus e Grafana para monitoramento local
- Swagger em /api-doc
- Health check em /health

## Estrutura Atual

```text
src/
  auth/
  video/
  infrastructure/
  shared/
  main.ts
  main.worker.ts
prisma/
k8s/
docker-compose.yml
.github/workflows/ci-cd.yml
```

## Stack

- NestJS + TypeScript
- PostgreSQL + Prisma
- Redis + Bull
- JWT + bcryptjs
- FFmpeg via fluent-ffmpeg + ffmpeg-static
- Nodemailer + MailHog
- Datadog tracing + logs estruturados
- Prometheus + Grafana
- Docker Compose
- GitHub Actions + GHCR + Kubernetes manifests

## Como Subir Localmente

### Com Docker Compose

```bash
docker compose up -d postgres redis mailhog prometheus grafana
docker compose up -d --build api worker frontend
```

Acessos locais:

- API: http://localhost:3001
- Frontend: http://localhost:4173
- Swagger: http://localhost:3001/api-doc
- Health: http://localhost:3001/health
- MailHog: http://localhost:8025
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- PostgreSQL host: localhost:5436
- Redis host: localhost:6380

### Sem Docker

Requer PostgreSQL, Redis e MailHog locais ou equivalentes.

```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run start:api
npm run start:worker
```

## Reset de senha por link

O link enviado por email aponta para o backend (por padrao `http://localhost:3001/auth/reset-password`) enquanto o frontend nao foi criado.

- Ao abrir o link, a API exibe uma pagina simples para informar nova senha e confirmar.
- O envio do link vai para o email do usuario cadastrado no sistema.

### SMTP de desenvolvimento (MailHog)

- `SMTP_HOST=mailhog`
- `SMTP_PORT=1025`
- MailHog UI: `http://localhost:8025`

### SMTP real (envio para caixa de email real)

Configure no `.env`:

```bash
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_AUTH_USER=<defina_no_ambiente_local>
SMTP_AUTH_PASS=<defina_no_ambiente_local>
SMTP_FROM=<defina_no_ambiente_local>
PASSWORD_RESET_URL_BASE=http://localhost:3001/auth/reset-password
```

Com isso, o backend passa a enviar para o email real cadastrado do usuario.

## Fluxo Funcional

1. Registrar usuario em /auth/register com confirmPassword.
2. Autenticar em /auth/login.
3. Em caso de esquecimento, solicitar link em /auth/forgot-password.
4. Redefinir senha com token em /auth/reset-password.
5. Enviar video em /videos/upload.
6. API cria job PENDING e publica na fila.
7. Worker dedicado consome o job, extrai frames com FFmpeg e gera um ZIP.
8. Job evolui para PROCESSING e depois COMPLETED ou FAILED.
9. Usuario acompanha em /videos/jobs.
10. Usuario faz download do ZIP em /videos/download/:jobId.
11. Notificacao por email e registro em notifications sao gerados ao fim do processamento.

## Execucao Para Banca (Roteiro Oficial)

1. Subir stack:

```bash
docker compose up -d postgres redis mailhog prometheus grafana
docker compose up -d --build api worker frontend
```

2. Validar API:

```bash
curl http://localhost:3001/health
```

3. Rodar testes backend:

```bash
npm install
npm run db:generate
npm run test
npm run test:e2e
```

4. Rodar smoke test opcional (sem upload de video):

```bash
npm run smoke:test
```

5. Rodar smoke test com upload real:

```bash
SMOKE_VIDEO_FILE=./sample.mp4 npm run smoke:test
```

Observacao: em Windows PowerShell, use `$env:SMOKE_VIDEO_FILE="./sample.mp4"; npm run smoke:test`.

## Comandos Uteis

```bash
npm run test
npm run test:cov
npm run test:e2e
npm run smoke:test
npm run build

docker compose logs -f api
docker compose logs -f worker
docker compose ps
```

## Deploy

O workflow em .github/workflows/ci-cd.yml faz:

- lint
- testes com cobertura
- testes e2e
- lint/build do frontend
- build
- scan de seguranca
- build e push da imagem para GHCR
- deploy dos manifests em k8s/ com kubectl quando houver KUBE_CONFIG_BASE64

## Documentacao Relacionada

- QUICKSTART.md
- API_DOCUMENTATION.md
- ARCHITECTURE.md
- DELIVERABLES.md

Observacao para avaliacao:

- O diagrama obrigatorio de arquitetura esta em ARCHITECTURE.md.
- Diagramas C4 e de sequencia podem ser adicionados como diferencial (opcional).
