# Status de Entregaveis

## Resumo

O projeto esta implementado com fluxo fim a fim para autenticacao, upload, fila, processamento, download, notificacao, observabilidade e deploy por artefatos.

Status solicitado: pontos do desafio fechados, exceto o item de video de apresentacao.

## Links dos Projetos (Github)

- Backend/API + Worker: https://github.com/wenceslauthiagon/fiapx-video-microservices
- Frontend (repo separado): https://github.com/wenceslauthiagon/fiapx-video-frontend

## Requisitos Funcionais

- [x] Cadastro e login com JWT
- [x] Confirmacao de senha no cadastro
- [x] Upload de video com limite de 50 MB
- [x] Fila para processamento assincrono
- [x] Processamento concorrente configuravel
- [x] Processamento real com FFmpeg e geracao de ZIP com frames
- [x] Listagem de jobs por usuario autenticado
- [x] Download do arquivo processado
- [x] Notificacao por email de sucesso e erro

Evidencias-chave dos requisitos mais sensiveis:

- Processar mais de um video ao mesmo tempo: concorrencia do worker controlada por `VIDEO_WORKER_CONCURRENCY` no processamento da fila.
- Nao perder requisicoes em picos: uso de fila Redis/Bull + persistencia de job no banco + outbox (`videoJobQueueOutbox`) antes do processamento.

## Requisitos Tecnicos

- [x] PostgreSQL com Prisma
- [x] Redis com Bull
- [x] Worker dedicado separado da API
- [x] Docker Compose para ambiente local
- [x] Swagger e health check
- [x] Logs estruturados com traceId e ip
- [x] CI/CD com lint, testes, build, scan e push para GHCR
- [x] Manifests Kubernetes em k8s/
- [x] Cobertura de testes validada no padrao atual do projeto

## Entregaveis Oficiais

- [x] Documentacao da arquitetura proposta
- [x] Script de criacao de banco e recursos (migrations + compose)
- [x] Link do(s) projeto(s) no Github
- [ ] Video de apresentacao (nao incluido neste fechamento)

## Diferenciais de Documentacao

- [x] Diagrama obrigatorio de arquitetura em ARCHITECTURE.md + docs/diagrams/architecture.svg
- [x] Diagrama C4 (Container) em ARCHITECTURE.md + docs/diagrams/c4-container.svg
- [x] Diagrama de Sequencia (Esqueci Minha Senha) em ARCHITECTURE.md + docs/diagrams/sequence-forgot-password.svg
- [x] Diagrama de Sequencia (Upload e Processamento) em ARCHITECTURE.md + docs/diagrams/sequence-video-processing.svg

## Evidencias no codigo

- API HTTP: src/main.ts
- Worker dedicado: src/main.worker.ts
- Processamento FFmpeg: src/video/video-processor.service.ts
- Docker local: docker-compose.yml
- Deploy: .github/workflows/ci-cd.yml
- Kubernetes: k8s/
- Scripts de banco: prisma/migrations/001_initial.sql e prisma/migrations/002_password_reset_tokens.sql

## Observacoes honestas

- O deploy automatico exige o secret KUBE_CONFIG_BASE64 configurado no GitHub Actions.
- Os manifests em k8s/ cobrem API, worker, postgres, redis e mailhog para um ambiente base.
- A fonte mais fiel da API em runtime continua sendo o Swagger em /api-doc.

## Roteiro curto de demo

1. Subir postgres, redis, mailhog, prometheus e grafana.
2. Subir api e worker.
3. Mostrar /health e /api-doc.
4. Registrar usuario e autenticar.
5. Fazer upload e acompanhar PENDING -> PROCESSING -> COMPLETED.
6. Fazer download do arquivo final.
7. Mostrar email no MailHog.
8. Mostrar logs estruturados e workflow de CI/CD.
