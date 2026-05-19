# Guia de Execução - FIAP X Video Processor

## ⚡ Quick Start (3 minutos)

### Pré-requisitos
- Docker & Docker Compose instalados
- Git
- Node.js 18+ (opcional, para dev local)

### Passo 1: Clonar o repositório
```bash
git clone <seu-repo> projeto-fiapx
cd projeto-fiapx
```

### Passo 2: Configurar ambiente
```bash
cp .env.example .env
# Editar .env se necessário (senhas, portas, etc)
```

### Passo 3: Subir toda a infraestrutura
```bash
docker-compose up -d
```

**O que sobe:**
- PostgreSQL (porta 5432)
- Redis (porta 6379)
- MailHog (portas 1025 SMTP, 8025 Web UI)
- API Gateway (porta 3001)
- Video Worker (background)
- Notification Service (background)
- Prometheus (porta 9090)
- Grafana (porta 3000)

### Passo 4: Verificar se está tudo rodando
```bash
docker-compose ps

# Ou testar o health check
curl http://localhost:3001/health
```

## 🧪 Testar a API

### 1. Registrar novo usuário
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123",
    "name": "John Doe"
  }'
```

**Resposta:**
```json
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "usr_...",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Salvar o token!**
```bash
TOKEN="eyJhbGc..."  # Cole seu token aqui
```

### 2. Fazer upload de um vídeo
```bash
curl -X POST http://localhost:3001/videos/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/caminho/para/seu/video.mp4"
```

**Resposta:**
```json
{
  "id": "job_...",
  "status": "PENDING",
  "fileName": "video.mp4",
  "createdAt": "2026-05-19T..."
}
```

**Salvar o jobId!**
```bash
JOB_ID="job_..."
```

### 3. Listar vídeos em processamento
```bash
curl -X GET "http://localhost:3001/videos/jobs?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta (em tempo real):**
```json
{
  "jobs": [
    {
      "id": "job_...",
      "fileName": "video.mp4",
      "status": "PROCESSING",  // Vai para COMPLETED em ~10-30s
      "progress": 50,
      "frameCount": null,
      "createdAt": "2026-05-19T...",
      "finishedAt": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

### 4. Aguardar conclusão (polling)
```bash
# Até o status ficar COMPLETED
while true; do
  curl -X GET "http://localhost:3001/videos/jobs" \
    -H "Authorization: Bearer $TOKEN" | jq '.jobs[0].status'
  sleep 2
done
```

### 5. Fazer download do ZIP
```bash
curl -X GET "http://localhost:3001/videos/download/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -o frames.zip

unzip frames.zip
ls -la  # Ver os frames extraídos
```

### 6. Verificar email enviado
- Abra http://localhost:8025
- Você verá o email de confirmação/sucesso

## 📊 Monitoramento

### Grafana (Dashboards)
- URL: http://localhost:3000
- User: admin
- Password: admin
- Métricas: CPU, Memory, Queue size, Latency

### Prometheus (Scraper)
- URL: http://localhost:9090
- Query exemplos:
  - `rate(http_requests_total[5m])` - Taxa de requests
  - `histogram_quantile(0.95, http_duration_seconds)` - P95 latency

### MailHog (Email Testing)
- URL: http://localhost:8025
- Ver todos os emails enviados
- Debug de templates

## 🔍 Logs

```bash
# Ver logs de um serviço específico
docker-compose logs -f api-gateway
docker-compose logs -f video-worker
docker-compose logs -f notification-service

# Ver apenas as últimas 50 linhas
docker-compose logs --tail=50 api-gateway
```

## 🛑 Parar tudo

```bash
docker-compose down
```

## 🗑️ Limpar (remover dados persistentes)

```bash
docker-compose down -v
# Remove volumes (banco de dados, redis, etc)
```

## 🐛 Troubleshooting

### API não responde
```bash
# Verificar se está rodando
docker-compose ps api-gateway

# Ver logs
docker-compose logs api-gateway

# Reiniciar
docker-compose restart api-gateway
```

### Video não processa
```bash
# Verificar worker
docker-compose logs video-worker

# Checar se ffmpeg está instalado
docker-compose exec video-worker which ffmpeg

# Testar ffmpeg
docker-compose exec video-worker ffmpeg -version
```

### Banco de dados inacessível
```bash
# Verificar PostgreSQL
docker-compose logs postgres

# Reconectar
docker-compose restart postgres

# Limpar e reiniciar fresh
docker-compose down -v
docker-compose up -d
yarn db:migrate
```

### Redis não conecta
```bash
# Verificar Redis
docker-compose logs redis

# Testar conexão
docker-compose exec redis redis-cli ping
# Resposta esperada: PONG
```

## 📝 Desenvolvimento Local (sem Docker)

Se preferir rodar local (requer PostgreSQL + Redis instalados):

```bash
# Terminal 1 - API Gateway
yarn workspace @fiapx/api-gateway start:dev

# Terminal 2 - Video Worker
yarn workspace @fiapx/video-worker start:dev

# Terminal 3 - Notification Service
yarn workspace @fiapx/notification-service start:dev
```

Configurar .env para apontar para localhost:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fiapx_videos
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 🧪 Rodar Testes

```bash
# Todos os testes
yarn test

# Com cobertura
yarn test:cov

# Watch mode
yarn test:watch

# Apenas um app
yarn workspace @fiapx/api-gateway test:cov
```

## 📦 Build para Produção

```bash
# Build de todos os apps
yarn build

# Gerar Prisma Client
yarn db:generate

# Build das imagens Docker
docker build -f apps/api-gateway/Dockerfile -t fiapx-api-gateway:prod .
docker build -f apps/video-worker/Dockerfile -t fiapx-video-worker:prod .
docker build -f apps/notification-service/Dockerfile -t fiapx-notification-service:prod .
```

## 🚀 Deploy em Kubernetes

```bash
# Aplicar manifests
kubectl apply -f k8s/

# Verificar pods
kubectl get pods -n fiapx

# Ver logs
kubectl logs -f pod/video-worker-xxx -n fiapx
```

## 📞 Dúvidas?

- Checar [README.md](README.md) para visão geral
- Checar [ARCHITECTURE.md](ARCHITECTURE.md) para detalhes técnicos
- Ver logs do Docker: `docker-compose logs -f`
