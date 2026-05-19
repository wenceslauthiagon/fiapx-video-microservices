# API Documentation - FIAP X Video Processor

## Base URL
```
http://localhost:3001
```

## Autenticação
Usar JWT Bearer token no header:
```
Authorization: Bearer <token>
```

---

## 🔐 Endpoints de Autenticação

### POST /auth/register
Registrar novo usuário

**Request:**
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_1234567890abc",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Erros:**
- `400`: Email already registered
- `400`: Invalid email format
- `400`: Password too short

---

### POST /auth/login
Fazer login

**Request:**
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_1234567890abc",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Erros:**
- `401`: Invalid credentials
- `400`: Missing email or password

---

## 🎬 Endpoints de Vídeo

### POST /videos/upload
Fazer upload de vídeo para processamento

**Request:**
```bash
POST /videos/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<video_file>
```

**Formatos suportados:** MP4, AVI, MOV, MKV, WMV, FLV, WEBM

**Response (200):**
```json
{
  "id": "job_1234567890abc",
  "status": "PENDING",
  "fileName": "myvideo.mp4",
  "createdAt": "2026-05-19T10:30:45.123Z"
}
```

**Erros:**
- `401`: Unauthorized (token inválido/ausente)
- `400`: No file provided
- `400`: Unsupported file format
- `413`: File too large

---

### GET /videos/jobs
Listar vídeos do usuário

**Request:**
```bash
GET /videos/jobs?page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1): Página
- `limit` (optional, default: 10): Itens por página

**Response (200):**
```json
{
  "jobs": [
    {
      "id": "job_1234567890abc",
      "fileName": "myvideo.mp4",
      "status": "COMPLETED",
      "progress": 100,
      "frameCount": 45,
      "createdAt": "2026-05-19T10:30:45.123Z",
      "finishedAt": "2026-05-19T10:35:20.456Z"
    },
    {
      "id": "job_9876543210xyz",
      "fileName": "video2.mp4",
      "status": "PROCESSING",
      "progress": 50,
      "frameCount": null,
      "createdAt": "2026-05-19T10:40:00.000Z",
      "finishedAt": null
    },
    {
      "id": "job_5555555555aaa",
      "fileName": "video3.mp4",
      "status": "FAILED",
      "progress": 0,
      "frameCount": null,
      "createdAt": "2026-05-19T09:00:00.000Z",
      "finishedAt": "2026-05-19T09:05:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 10
}
```

**Status possíveis:**
- `PENDING`: Aguardando processamento
- `PROCESSING`: Em processamento
- `COMPLETED`: Processado com sucesso
- `FAILED`: Erro no processamento
- `CANCELLED`: Cancelado pelo usuário

**Erros:**
- `401`: Unauthorized

---

### GET /videos/download/:jobId
Fazer download do vídeo processado (ZIP com frames)

**Request:**
```bash
GET /videos/download/job_1234567890abc
Authorization: Bearer <token>
```

**Response (200):**
```
[Binary ZIP file]
Content-Type: application/zip
Content-Disposition: attachment; filename="frames_1234567890.zip"
```

**Erros:**
- `401`: Unauthorized
- `403`: Forbidden (job pertence a outro usuário)
- `404`: Job not found
- `409`: Job is not ready for download (status != COMPLETED)

---

## 📊 Status Codes

| Código | Significado |
|--------|------------|
| 200 | OK - Sucesso |
| 201 | Created - Recurso criado |
| 400 | Bad Request - Parâmetros inválidos |
| 401 | Unauthorized - Token inválido/ausente |
| 403 | Forbidden - Sem permissão |
| 404 | Not Found - Recurso não encontrado |
| 409 | Conflict - Estado inválido |
| 413 | Payload Too Large - Arquivo muito grande |
| 500 | Internal Server Error - Erro no servidor |

---

## 🔄 Fluxo Típico

1. **Registrar/Login**
   ```bash
   curl -X POST http://localhost:3001/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "pass123", "name": "John"}'
   ```
   Salvar o token retornado

2. **Upload de vídeo**
   ```bash
   curl -X POST http://localhost:3001/videos/upload \
     -H "Authorization: Bearer <TOKEN>" \
     -F "file=@video.mp4"
   ```
   Salvar o jobId retornado

3. **Verificar status (polling)**
   ```bash
   curl -X GET http://localhost:3001/videos/jobs \
     -H "Authorization: Bearer <TOKEN>"
   ```
   Repetir até status = COMPLETED

4. **Download**
   ```bash
   curl -X GET http://localhost:3001/videos/download/<JOB_ID> \
     -H "Authorization: Bearer <TOKEN>" \
     -o frames.zip
   ```

---

## 🧪 Exemplos com cURL

### Criar usuário
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "AlicePassword123",
    "name": "Alice"
  }' | jq
```

### Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "AlicePassword123"
  }' | jq '.access_token' -r
```

### Upload com o token
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3001/videos/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@~/Downloads/sample.mp4" | jq
```

### Listar jobs
```bash
curl -X GET "http://localhost:3001/videos/jobs?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Download
```bash
JOB_ID="job_1234567890abc"

curl -X GET "http://localhost:3001/videos/download/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -o output.zip

unzip -l output.zip
```

---

## 📧 Webhooks (Futuro)

Quando implementado, notificações podem ser enviadas para um webhook:

```json
{
  "event": "video_processing_completed",
  "jobId": "job_123",
  "userId": "usr_456",
  "frameCount": 45,
  "timestamp": "2026-05-19T10:35:20Z",
  "downloadUrl": "https://api.example.com/videos/download/job_123"
}
```

---

## 🔒 Segurança

- ✅ Todos os endpoints requerem autenticação JWT (exceto /auth/*)
- ✅ Os dados de um usuário são isolados (não vê jobs de outros)
- ✅ Senhas são armazenadas com hash bcryptjs
- ✅ JWT expira em 7 dias
- ✅ CORS habilitado para localhost:3000 (frontend dev)

---

## 📝 Notas

- Processamento é **assíncrono** - upload retorna imediatamente, processamento acontece em background
- Email de notificação é enviado quando o vídeo termina (sucesso ou erro)
- A UI pode fazer polling a cada 2-5 segundos para atualizar status
- Dados persistem em PostgreSQL - reiniciar containers não deleta dados
