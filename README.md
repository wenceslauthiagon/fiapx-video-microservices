# FIAP X - Video Processing System

Sistema de processamento de vídeos com arquitetura hexagonal e microsserviços baseado em NestJS.

## 🏗️ Arquitetura

```
├── apps/
│   ├── api-gateway/           # API principal (upload, auth, status)
│   ├── video-worker/          # Worker para processar vídeos
│   └── notification-service/  # Serviço de notificações por email
├── libs/
│   └── common/                # Código compartilhado
├── prisma/                    # Schema e migrações do banco
└── docker-compose.yml         # Orquestração de infraestrutura
```

## 🔧 Stack Tecnológico

- **Framework**: NestJS
- **Linguagem**: TypeScript
- **Banco de Dados**: PostgreSQL
- **Cache/Fila**: Redis + BullMQ
- **Autenticação**: JWT
- **Email**: NodeMailer + MailHog
- **Processamento de Vídeo**: FFmpeg
- **Monitoramento**: Prometheus + Grafana
- **Container**: Docker + Docker Compose

## 📋 Requisitos

- Docker & Docker Compose
- Node.js 18+ (para desenvolvimento local)
- FFmpeg

## 🚀 Quickstart

### 1. Clonar e instalar dependências

```bash
git clone <repository>
cd projeto-fiapx
yarn install
```

### 2. Configurar ambiente

```bash
cp .env.example .env
```

### 3. Subir infraestrutura com Docker Compose

```bash
docker-compose up -d
```

Isso inicia:
- PostgreSQL (porta 5432)
- Redis (porta 6379)
- MailHog SMTP (porta 1025)
- MailHog Web UI (porta 8025)
- API Gateway (porta 3001)
- Video Worker (background)
- Notification Service (background)
- Prometheus (porta 9090)
- Grafana (porta 3000)

### 4. Executar migrações do banco

```bash
yarn db:migrate
```

### 5. Acessar aplicação

- **API**: http://localhost:3001
- **MailHog**: http://localhost:8025
- **Grafana**: http://localhost:3000 (user: admin, pass: admin)
- **Prometheus**: http://localhost:9090

## 📚 Endpoints da API

### Autenticação

**Registrar novo usuário**
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Login**
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

### Vídeos

**Upload de vídeo** (requer JWT)
```bash
POST /videos/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <video file>
```

**Listar vídeos processados** (requer JWT)
```bash
GET /videos/jobs?page=1&limit=10
Authorization: Bearer <token>
```

**Download do vídeo processado** (requer JWT)
```bash
GET /videos/download/:jobId
Authorization: Bearer <token>
```

## 🧪 Testes

```bash
# Rodar testes em todos os apps
yarn test

# Rodar com cobertura
yarn test:cov

# Watch mode
yarn test:watch
```

## 🔍 Monitoramento

- **Prometheus**: Métricas em tempo real
- **Grafana**: Dashboards customizados
- **MailHog**: Visualizar emails enviados

## 🛠️ Desenvolvimento Local

Sem Docker (requer PostgreSQL e Redis locais):

```bash
# API Gateway
yarn workspace @fiapx/api-gateway start:dev

# Video Worker (em outro terminal)
yarn workspace @fiapx/video-worker start:dev

# Notification Service (em outro terminal)
yarn workspace @fiapx/notification-service start:dev
```

## 📦 Build para Produção

```bash
yarn build
```

## 🐳 Docker Compose Commands

```bash
# Subir serviços
docker-compose up -d

# Parar serviços
docker-compose down

# Ver logs
docker-compose logs -f <service-name>

# Entrar em um container
docker-compose exec <service-name> sh
```

## 📊 Estrutura do Banco de Dados

### Users
- id (PK)
- email (unique)
- password (hashed)
- name
- createdAt, updatedAt

### VideoJobs
- id (PK)
- userId (FK)
- originalFileName
- status (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)
- progress
- inputPath
- outputPath
- frameCount
- error
- createdAt, updatedAt, startedAt, finishedAt

### Notifications
- id (PK)
- jobId (FK)
- type (EMAIL, WEBHOOK, TELEGRAM)
- message
- sent
- sentAt
- createdAt

## 🔐 Segurança

- ✅ JWT para autenticação
- ✅ Isolamento de dados por usuário
- ✅ Validação de entrada (class-validator)
- ✅ Hash de senha com bcryptjs
- ✅ CORS configurado
- ✅ Rate limiting (implementar em produção)

## 📝 Fluxo de Processamento

1. Usuário faz login e recebe JWT
2. Usuário faz upload de vídeo
3. API salva job com status PENDING e publica em fila
4. Video Worker consome job da fila
5. FFmpeg processa vídeo e extrai frames
6. Job é atualizado para COMPLETED
7. Notification Service envia email ao usuário
8. Usuário faz download do ZIP com frames

## 🤝 Contribuindo

1. Crie uma feature branch: `git checkout -b feature/minha-feature`
2. Commit suas mudanças: `git commit -am 'Add some feature'`
3. Push para a branch: `git push origin feature/minha-feature`
4. Abra um Pull Request

## 📄 Licença

MIT

## 👥 Autores

FIAP Team - Hackathon 2026
