# PROJECT RUN GUIDE

Полный гайд для локального запуска AI Meet Factory.

## 1) Что нужно заранее

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

```bash
node -v && pnpm -v && docker --version
```

Если чего-то нет:

- Node.js: [nodejs.org](https://nodejs.org/)
- pnpm: `npm install -g pnpm`
- Docker Desktop: [docker.com](https://www.docker.com/products/docker-desktop/)

## 2) Поднять инфраструктуру (Postgres, Redis, Mailpit)

```bash
docker compose -f infra/docker-compose.yml up -d
```

Проверка:

```bash
docker compose -f infra/docker-compose.yml ps
```

Сервисы: Postgres (5432) · Redis (6379) · Mailpit UI (8025)

## 3) Установить зависимости

```bash
pnpm install
```

## 4) Настроить backend env

```bash
cp apps/backend/.env.example apps/backend/.env
```

Ключевые переменные в `apps/backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://meeting_ai:meeting_ai@localhost:5432/meeting_ai?schema=public
JWT_SECRET=change_me
REDIS_URL=redis://localhost:6379
UPLOAD_DIR=./uploads
MAX_MEETING_MINUTES=120
APP_URL=http://localhost:5173

# AI провайдеры (mock не требует ключей)
TRANSCRIPTION_PROVIDER=mock
POSTPROCESSING_PROVIDER=mock

# Email (Mailpit работает без настройки)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=meeting-ai@example.local
```

## 5) Применить миграции

```bash
pnpm --filter @meeting-ai/backend prisma:migrate
```

> Миграции включают автоматический seed тарифных планов (free, starter, pro).

## 6) Запустить всё одной командой (рекомендуется)

```bash
pnpm dev:all
```

Запускает backend API + worker + frontend одновременно. Ctrl+C останавливает всё.

> **Важно:** worker обязателен — без него транскрибация не запустится.

Либо по отдельности в трёх терминалах:

```bash
pnpm dev:backend    # Терминал 1 — API на :4000
pnpm dev:worker     # Терминал 2 — BullMQ worker
pnpm dev:frontend   # Терминал 3 — Vite на :5173
```

Адреса: Frontend: `http://localhost:5173` · API: `http://localhost:4000/api` · Почта: `http://localhost:8025`

## 7) Первоначальная настройка admin-функций

После первого запуска:

1. Зарегистрироваться → подтвердить email (письмо в Mailpit)
2. Через SQL дать себе права admin:

```bash
docker exec infra-postgres-1 psql -U meeting_ai -d meeting_ai \
  -c 'UPDATE "User" SET "isAdmin" = true WHERE email = '"'"'your@email.com'"'"';'
```

1. Зайти в `/admin/archive` → нажать «Создать архивариуса» (нужно сделать один раз)

## 8) Smoke test

1. Открыть `http://localhost:5173/register` → зарегистрироваться → подтвердить email
2. Войти → создать встречу → загрузить аудио/видео файл
3. Дождаться завершения pipeline
4. Проверить вкладки: транскрипция, спикеры, саммари, задачи, чат, экспорт
5. Проверить admin-панель:

- `/admin/dashboard` — аналитика
- `/admin/runs` — журнал обработок
- `/admin/users` — управление пользователями
- `/admin/subscriptions` — подписки
- `/admin/archive` — архив удалённых пользователей

## 9) Полезные команды

```bash
# TypeScript проверка
pnpm --filter @meeting-ai/backend lint
pnpm --filter @meeting-ai/frontend lint

# Сборка всего monorepo
pnpm build

# Просмотр очереди Redis
docker exec infra-redis-1 redis-cli llen bull:meeting-processing:wait
```

## 10) Типичные проблемы

**Транскрибация не запускается** — worker не запущен. Запусти `pnpm dev:worker`.

**Не подключается к БД** — проверь что Postgres поднят: `docker compose -f infra/docker-compose.yml ps`.

**Email не приходит** — открой Mailpit: `http://localhost:8025`.

**Ошибка EMAIL_NOT_VERIFIED при входе** — подтверди email через Mailpit или выполни:

```bash
docker exec infra-postgres-1 psql -U meeting_ai -d meeting_ai \
  -c 'UPDATE "User" SET "emailVerified" = true WHERE "emailVerifyToken" IS NULL AND "emailVerified" = false;'
```

**Удаление пользователя выдаёт ошибку NO_ARCHIVIST** — создай архивариуса в `/admin/archive`.
