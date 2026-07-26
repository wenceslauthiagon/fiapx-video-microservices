# API Documentation

## Base URL

```text
http://localhost:3001
```

## Interfaces auxiliares

- Swagger UI: /api-doc
- Health check: /health

## Autenticacao

As rotas protegidas usam:

```text
Authorization: Bearer <token>
```

## Health

### GET /health

Resposta de sucesso:

```json
{
  "status": "ok",
  "service": "fiapx-api",
  "timestamp": "2026-05-25T10:00:00.000Z",
  "uptimeSeconds": 123
}
```

## Auth

### POST /auth/register

Request:

```json
{
  "email": "user@example.com",
  "password": "123456",
  "confirmPassword": "123456",
  "name": "John Doe"
}
```

Resposta de sucesso:

```json
{
  "access_token": "jwt-token",
  "user": {
    "id": "<user-id>",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

Erros comuns:

- 400: Password and confirmPassword must match
- 400: Invalid email format
- 409: Email already registered
- 503: Database schema not initialized. Please run migrations.

### POST /auth/login

Request:

```json
{
  "email": "user@example.com",
  "password": "123456"
}
```

Resposta de sucesso:

```json
{
  "access_token": "jwt-token",
  "user": {
    "id": "<user-id>",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

Erros comuns:

- 401: Invalid credentials
- 503: Database schema not initialized. Please run migrations.

### POST /auth/forgot-password

Request:

```json
{
  "email": "user@example.com"
}
```

Resposta de sucesso:

```json
{
  "message": "If the email exists, a password reset link was sent."
}
```

Observacoes:

- A resposta e propositalmente generica para nao expor se o email existe.
- O backend envia email com link de redefinicao.
- O token expira em 1 hora.

### POST /auth/reset-password

Request:

```json
{
  "token": "token-recebido-por-email",
  "password": "123456",
  "confirmPassword": "123456"
}
```

Resposta de sucesso:

```json
{
  "message": "Password reset successfully"
}
```

Erros comuns:

- 400: Password and confirmPassword must match
- 404: Invalid or expired reset token

## Videos

### POST /videos/upload

Headers:

```text
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Campo esperado:

- file: arquivo de video com limite de 50 MB

Resposta de sucesso:

```json
{
  "id": "job_1710000000000",
  "status": "PENDING",
  "fileName": "sample.mp4",
  "createdAt": "2026-05-25T10:00:00.000Z"
}
```

Erros comuns:

- 400: File is required
- 401: Unauthorized
- 413: File too large. Maximum allowed size is 50 MB

### GET /videos/jobs?page=1&limit=10

Resposta de sucesso:

```json
{
  "jobs": [
    {
      "id": "job_1710000000000",
      "userId": "<user-id>",
      "originalFileName": "sample.mp4",
      "status": "COMPLETED",
      "progress": 100,
      "inputPath": "uploads/...",
      "outputPath": "outputs/...",
      "error": null,
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:10.000Z",
      "startedAt": "2026-05-25T10:00:01.000Z",
      "finishedAt": "2026-05-25T10:00:10.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

Status possiveis:

- PENDING
- PROCESSING
- COMPLETED
- FAILED

### GET /videos/download/:jobId

Baixa o artefato final do job autenticado (arquivo ZIP com frames extraidos do video).

### GET /videos/watch/:jobId

Abre o arquivo original enviado no job autenticado para visualizacao inline no navegador.

Erros comuns:

- 401: Unauthorized
- 404: File not found
- 500: para job inexistente, job de outro usuario ou job ainda nao pronto a implementacao atual propaga erro generico do service

## Fluxo recomendado de teste

1. Registrar usuario.
2. Fazer login.
3. Solicitar reset em /auth/forgot-password.
4. Abrir o email no MailHog e copiar o token do link.
5. Enviar /auth/reset-password com token, password e confirmPassword.
6. Fazer login com a nova senha.
7. Enviar upload autenticado.
8. Consultar /videos/jobs ate o status ficar COMPLETED.
9. Fazer download do ZIP de frames resultante.
10. Verificar notificacao em http://localhost:8025.

## Observacao importante

A documentacao viva mais fiel para request bodies e schemas e o Swagger exposto em /api-doc.
