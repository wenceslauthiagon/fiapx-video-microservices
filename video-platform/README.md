# FIAP X Video Platform

Este diretorio concentra artefatos auxiliares usados durante a evolucao do desafio. A implementacao principal e avaliada a partir da raiz do repositorio, com API e worker dedicado rodando sobre PostgreSQL, Redis, Bull e FFmpeg.

## Estado atual da solucao principal

- API NestJS com JWT, upload, listagem e download
- Worker dedicado para consumo da fila e processamento de video
- PostgreSQL para persistencia de users, video_jobs e notifications
- Redis + Bull para fila assincrona
- MailHog para inspecao de emails em desenvolvimento
- Observabilidade com logs estruturados, tracing, Prometheus e Grafana

## Endpoints principais da implementacao ativa

- `POST /auth/register`
- `POST /auth/login`
- `GET /health`
- `POST /videos/upload`
- `GET /videos/jobs`
- `GET /videos/download/:jobId`

## Observacoes

- O upload atual tem limite de 50 MB.
- O processamento usa FFmpeg e gera o artefato final no diretorio de output.
- A notificacao e enviada pelo proprio worker ao final do processamento, com persistencia na tabela `notifications`.
- A referencia viva da API esta no Swagger exposto em `/api-doc` pela aplicacao raiz.
