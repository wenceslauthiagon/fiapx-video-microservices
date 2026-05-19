# FIAP X - Arquitetura de Microserviços

## 📋 Visão Geral

Sistema de processamento de vídeos com arquitetura baseada em **hexagonal (ports & adapters)** e **microsserviços**, permitindo escalabilidade horizontal e tolerância a falhas.

## 🏗️ Arquitetura

### Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────┐
│                    Camada de Apresentação                    │
│                  (Cliente Web / Mobile App)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS/REST
┌──────────────────────────▼──────────────────────────────────┐
│                     API Gateway (Port 3001)                 │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────────────┐ │
│  │   Auth     │  │  Upload  │  │  Status / Download      │ │
│  │  (JWT)     │  │  Vídeo   │  │  (User-specific)        │ │
│  └────────────┘  └──────────┘  └──────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    (BullMQ Queue)   (Redis Cache)      (PostgreSQL DB)
        │                  │                  │
┌───────▼──────────┐  ┌────▼────┐  ┌────────▼──────────┐
│  Video Worker    │  │  Redis  │  │   PostgreSQL      │
│  (Background)    │  │  7.0    │  │   13+             │
│  - FFmpeg        │  │         │  │                   │
│  - Extract       │  │         │  │  Users            │
│  - Compress      │  │         │  │  VideoJobs        │
│                  │  │         │  │  Notifications    │
└───────┬──────────┘  └────┬────┘  └────────┬──────────┘
        │                  │                  │
        └──────────┬───────┴──────────┬──────┘
                   │                  │
        ┌──────────▼──────────────────▼──────────┐
        │  Notification Service                  │
        │  - Escuta eventos via Redis Pub/Sub    │
        │  - Envia emails (NodeMailer + MailHog) │
        │  - Persiste status de notificações     │
        └────────────────────────────────────────┘
```

## 🔧 Componentes

### 1. API Gateway (api-gateway)

**Responsabilidades:**
- Autenticação via JWT
- Upload de vídeos
- Listagem de jobs com filtro por usuário
- Download de arquivos processados
- Validação de entrada

**Stack:**
- NestJS
- Express
- Prisma ORM
- JWT/Passport

**Ports & Adapters:**
- **Port**: IUserRepository, IVideoJobRepository, IQueueService
- **Adapter (entrada)**: HTTP Controllers
- **Adapter (saída)**: PrismaUserRepository, PrismaVideoJobRepository, BullMQService

### 2. Video Worker (video-worker)

**Responsabilidades:**
- Consumir jobs da fila BullMQ
- Processar vídeo com FFmpeg
- Extrair frames em PNG
- Criar arquivo ZIP
- Atualizar status no banco de dados
- Publicar eventos de sucesso/erro

**Stack:**
- Node.js puro (sem NestJS para ser leve)
- Bull (queue consumer)
- FFmpeg-static
- Prisma Client

**Fluxo:**
1. Lê job da fila
2. Atualiza status para PROCESSING
3. Executa ffmpeg: `ffmpeg -i video.mp4 -vf fps=1 frame_%04d.png`
4. Compacta frames em ZIP
5. Atualiza status para COMPLETED/FAILED
6. Publica evento em Redis Pub/Sub

### 3. Notification Service (notification-service)

**Responsabilidades:**
- Escutar eventos em Redis Pub/Sub
- Enviar emails de sucesso/erro
- Persistir status de notificação
- Suportar múltiplos canais (email, webhook, telegram - extensível)

**Stack:**
- Node.js
- NodeMailer
- Prisma Client
- Redis Client

**Fluxo:**
1. Subscreve canal `video-events` no Redis
2. Recebe evento: `{ type: 'VIDEO_PROCESSING_COMPLETED', jobId, userId, frameCount }`
3. Busca usuário no DB
4. Envia email via MailHog (dev) / SMTP (prod)
5. Atualiza tabela `notifications` com status `sent: true`

## 📊 Fluxo de Dados

### Upload e Processamento

```
1. Cliente faz LOGIN
   GET /auth/login
   → Retorna JWT
   
2. Cliente faz UPLOAD
   POST /videos/upload (multipart/form-data) + JWT
   → API valida JWT
   → API salva arquivo em ./uploads/
   → API cria VideoJob (status: PENDING) no DB
   → API publica job em fila BullMQ
   → Retorna { jobId, status: PENDING }
   
3. Video Worker consome job
   → Atualiza job (status: PROCESSING)
   → Executa ffmpeg
   → Salva ZIP em ./outputs/
   → Atualiza job (status: COMPLETED, outputPath, frameCount)
   → Publica evento: VIDEO_PROCESSING_COMPLETED
   
4. Notification Service recebe evento
   → Busca email do usuário
   → Envia email: "Seu vídeo foi processado! [link download]"
   
5. Cliente LIST JOBS (status page)
   GET /videos/jobs?page=1&limit=10 + JWT
   → Retorna apenas jobs do usuário autenticado
   
6. Cliente DOWNLOAD
   GET /videos/download/{jobId} + JWT
   → Valida propriedade do job (jobId pertence ao user)
   → Valida status (COMPLETED)
   → Faz download de ./outputs/{zipFile}
```

## 🔐 Segurança

### Autenticação & Autorização
- ✅ JWT com validade de 7 dias
- ✅ Hash bcryptjs (10 rounds) para senhas
- ✅ Guard em todas as rotas protegidas
- ✅ Isolamento de dados por user_id

### Validação
- ✅ class-validator em DTOs
- ✅ Whitelist de tipos de arquivo (video)
- ✅ Limite de tamanho de upload
- ✅ Sanitização de paths

### Infraestrutura
- ✅ CORS configurado
- ✅ Rate limiting (implementar em prod)
- ✅ HTTPS em produção
- ✅ Secrets no .env (não em repo)

## 📈 Escalabilidade

### Horizontal Scaling

**Video Workers:**
```bash
docker-compose scale video-worker=5 # 5 processos paralelos
```
- BullMQ distribui jobs entre workers
- Sem lock/mutex (stateless)
- Retry automático em caso de falha

**API Gateway:**
```bash
docker-compose scale api-gateway=3 # Load balancer (Nginx/HAProxy)
```
- Stateless (JWT)
- Shared database (PostgreSQL)
- Shared cache (Redis)

**Banco de Dados:**
- PostgreSQL com replicação/failover
- Backups automáticos
- Índices otimizados

**Redis:**
- Cluster mode para alta disponibilidade
- Persistência RDB/AOF
- Monitoramento com Sentinel

## 🧪 Testes

### Cobertura: 90%+

**Camadas testadas:**
- ✅ Domain Entities (regras de negócio)
- ✅ Use Cases (orquestração)
- ✅ Repositories (adapter)
- ✅ Services (business logic)
- ✅ Controllers (endpoints)

```bash
yarn test:cov

# Resultado esperado:
# ----------|---------|---------|---------|---------|
# File      | % Stmts | % Branch| % Funcs | % Lines |
# ----------|---------|---------|---------|---------|
# All files |  92.3%  |  88.7%  |  95.1%  |  92.0%  |
```

## 📊 Monitoramento

### Prometheus + Grafana

**Métricas coletadas:**
- API latency, request count, error rate
- Queue size, job processing time
- Database connection pool usage
- Redis memory, key count
- Worker CPU/Memory usage

**Alertas configurados:**
- Job queue backlog > 100
- API error rate > 5%
- Database replication lag > 1s
- Redis memory > 80%

## 🚀 Deploy

### Docker Compose (Dev/Staging)

```bash
docker-compose up -d
docker-compose logs -f
```

### Kubernetes (Production)

```yaml
# Video Worker Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: video-worker
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: video-worker
        image: fiapx-video-worker:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command: ["node", "/app/healthcheck.js"]
          initialDelaySeconds: 30
          periodSeconds: 10
```

## 🔄 CI/CD

**GitHub Actions Pipeline:**

```
┌─────────────────────┐
│  Push to main       │
└──────────┬──────────┘
           │
    ┌──────▼──────┐
    │  Lint       │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Test       │
    │  Coverage   │
    │  Gate 90%   │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Security   │
    │  Scan       │
    │  (Trivy)    │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Build      │
    │  Docker     │
    │  Images    │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Deploy     │
    │  to Prod    │
    │  (optional) │
    └─────────────┘
```

## 📁 Estrutura de Pastas

```
projeto-fiapx/
├── apps/
│   ├── api-gateway/               # API principal
│   │   ├── src/
│   │   │   ├── domain/            # Entidades puras
│   │   │   ├── application/       # Use-cases
│   │   │   ├── infrastructure/    # Adaptadores
│   │   │   ├── modules/           # NestJS modules
│   │   │   ├── common/            # DTOs, Guards, etc
│   │   │   └── main.ts            # Entry point
│   │   ├── test/                  # Testes unitários
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── video-worker/              # Worker de processamento
│   │   ├── src/
│   │   │   ├── services/
│   │   │   ├── infrastructure/
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   └── notification-service/      # Serviço de notificações
│       ├── src/
│       │   ├── services/
│       │   ├── infrastructure/
│       │   └── main.ts
│       └── package.json
│
├── libs/
│   └── common/                    # Código compartilhado
│
├── prisma/
│   ├── schema.prisma              # Schema do banco
│   └── migrations/                # Histórico de migração
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml              # GitHub Actions
│
├── docker-compose.yml             # Orquestração local
├── jest.config.js                 # Jest para todos os apps
├── tsconfig.json                  # TypeScript raiz
├── package.json                   # Workspace root
└── README.md
```

## 🎯 Requisitos Atendidos

✅ **Funcionalidades Essenciais**
- Processamento paralelo de múltiplos vídeos
- Fila com retry automático (não perde requisições em picos)
- Autenticação por JWT
- Listagem de status filtrada por usuário
- Notificação por email em caso de erro

✅ **Requisitos Técnicos**
- Persistência em PostgreSQL
- Escalabilidade horizontal (workers + replicas)
- Versionado no GitHub
- Testes com cobertura >= 90%
- CI/CD com GitHub Actions

✅ **Stack Tecnológica**
- Docker + Docker Compose (Kubernetes ready)
- BullMQ + Redis
- PostgreSQL + Redis
- Prometheus + Grafana
- GitHub Actions

## 📞 Contato & Suporte

Hackathon FIAP 2026 - Video Processing Team
