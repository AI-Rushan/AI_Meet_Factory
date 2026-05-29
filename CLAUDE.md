# AI Meet Factory — контекст проекта

Продукт для транскрибации и анализа встреч. Пользователь называет его **«продукт»**.

## Стек

- **Backend**: Node.js + TypeScript, Express, Prisma (PostgreSQL), BullMQ (Redis), tsx
- **Frontend**: React + TypeScript, Vite, React Query, React Router, Axios, Lucide icons
- **Email**: SMTP (Beget на продакшне) или Resend API; локально — Mailpit (порт 8025)
- **Monorepo**: pnpm workspaces
- **Весь фронтенд** — один файл `apps/frontend/src/App.tsx`, inline styles — принятый стиль проекта

## Структура

```
apps/backend/src/
  routes/      — auth.ts, admin.ts, meetings.ts
  services/    — authService.ts, meetingsService.ts, processingPipeline.ts
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
# 1. Инфраструктура
docker compose -f infra/docker-compose.yml up -d

# 2. Всё одной командой (backend + worker + frontend)
pnpm dev:all
```

Frontend: http://localhost:5173 · API: http://localhost:4000 · Почта: http://localhost:8025

## Продакшн

Сервер: `150.241.107.20` · URL: https://app.sense-ai.ru

```bash
# Подключение
sshpass -p 'Ruhmen78' ssh -o StrictHostKeyChecking=no root@150.241.107.20

# Деплой (на сервере)
cd /opt/meeting-ai
git pull origin main
cd apps/backend && npx prisma migrate deploy && npx prisma generate && cd ../..
cd apps/frontend && pnpm build && cd ../..
pm2 restart meeting-ai-api
```

> **Важно:** `prisma generate` обязателен после каждой миграции — без него бэкенд не видит новые поля.

## Ключевые особенности

- **Worker обязателен** — без него транскрибация не запускается (задачи висят в очереди)
- **emailVerified** — новые пользователи не могут войти без подтверждения email
- Пользователи, созданные через admin-панель, получают `emailVerified=true` автоматически
- **Архивариус** (`archivist@system.internal`) — хранит данные удалённых пользователей
- При переносе workspace встречи переезжают в личный workspace целевого пользователя

## Admin-панель (только для isAdmin=true)

- `/admin/dashboard` — аналитика по всем пользователям
- `/admin/runs` — журнал обработок
- `/admin/models` — AI-модели
- `/admin/users` — пользователи (создание, редактирование, блокировка, удаление)
- `/admin/subscriptions` — ручное управление подписками
- `/admin/archive` — workspace удалённых, переназначение встреч

## Тарифные планы (засеяны в БД)

| Код | Название | Цена | Минут/мес | Встреч/мес |
|---|---|---|---|---|
| free | Бесплатный | 0 ₽ | 60 | 5 |
| starter | Стартер | 490 ₽/мес | 300 | 20 |
| pro | Про | 990 ₽/мес | ∞ | ∞ |

## Ключевые пользователи в БД (продакшн)

- `rumerov@gmail.com` — основной admin
- `archivist@system.internal` — системный аккаунт (isArchivist=true, isBlocked=true)

## Миграции Prisma

БД не запущена локально → создавать миграции вручную в `apps/backend/prisma/migrations/`.
Применять: `prisma migrate deploy && prisma generate` — всегда оба шага вместе.
