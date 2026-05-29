# AI Meet Factory — контекст проекта

Продукт для транскрибации и анализа встреч. Пользователь называет его **«продукт»**.

## Стек

- **Backend**: Node.js + TypeScript, Express, Prisma (PostgreSQL), BullMQ (Redis), tsx
- **Frontend**: React + TypeScript, Vite, React Query, React Router, Axios, Lucide icons
- **Email**: SMTP (Beget) или Resend; локально — Mailpit (порт 8025)
- **Monorepo**: pnpm workspaces

## Структура

```
apps/backend/src/
  routes/      — auth.ts, admin.ts, meetings.ts
  services/    — authService.ts, meetingsService.ts
  lib/         — jwt.ts, hash.ts, mailer.ts
  prisma/      — schema.prisma, migrations/
apps/frontend/src/
  App.tsx      — весь фронтенд в одном файле
  api.ts       — axios instance + token helpers
infra/
  docker-compose.yml  — Postgres, Redis, Mailpit
ecosystem.config.cjs  — PM2 конфиг для продакшна
```

## Локальный запуск

```bash
# 1. Поднять инфраструктуру
docker compose -f infra/docker-compose.yml up -d

# 2. Запустить всё одной командой (backend + worker + frontend)
pnpm dev:all
```

Фронтенд: http://localhost:5173 · API: http://localhost:4000 · Почта: http://localhost:8025

## Деплой на сервер

Сервер: `150.241.107.20` · Продакшн: https://app.sense-ai.ru

```bash
# Подключение
sshpass -p 'Ruhmen78' ssh -o StrictHostKeyChecking=no root@150.241.107.20

# Обновление (на сервере)
cd /opt/meeting-ai
git pull origin main
cd apps/backend && npx prisma migrate deploy && npx prisma generate && cd ../..
cd apps/frontend && pnpm build && cd ../..
pm2 restart meeting-ai-api
```

> **Важно:** `prisma generate` обязателен после каждой миграции — без него бэкенд не видит новые поля.

## Миграции Prisma

БД не запущена локально → миграции создавать вручную в `apps/backend/prisma/migrations/`.
После создания файла: `npx prisma generate` (без deploy — нет БД).
На сервере: `prisma migrate deploy && prisma generate`.

## Ключевые особенности продукта

- **Worker обязателен** — без него транскрибация не запускается (задачи висят в очереди)
- **emailVerified** — новые пользователи не могут войти без подтверждения email
- **Архивариус** (`archivist@system.internal`) — хранит данные удалённых пользователей
- Фронтенд — один большой файл `App.tsx`, inline styles — принятый стиль проекта

## Важные пользователи

- `rumerov@gmail.com` — основной admin
- `archivist@system.internal` — системный аккаунт (isArchivist=true, isBlocked=true)
