# PROJECT RUN GUIDE

Ниже — полный пошаговый гайд для локального запуска проекта Meeting AI MVP.

## 1) Что нужно заранее

Убедись, что на машине установлены:

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

Проверка:

```bash
node -v
pnpm -v
docker --version
docker compose version
```

Если чего-то нет:

- Node.js: https://nodejs.org/
- pnpm: `npm install -g pnpm`
- Docker Desktop: https://www.docker.com/products/docker-desktop/

## 2) Перейти в папку проекта

```bash
cd "/Users/rushan/python/codex/My meeting AI"
```

## 3) Поднять инфраструктуру (Postgres, Redis, Mailpit)

Проект использует локальные сервисы из `infra/docker-compose.yml`:

- Postgres — основная БД
- Redis — очередь фоновой обработки
- Mailpit — локальный SMTP для теста email-экспорта

Запуск:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Проверка статуса:

```bash
docker compose -f infra/docker-compose.yml ps
```

Если сервисы не в `Up`, посмотри логи:

```bash
docker compose -f infra/docker-compose.yml logs
```

## 4) Установить зависимости monorepo

```bash
pnpm install
```

Это установит зависимости для:

- `apps/backend`
- `apps/frontend`
- `packages/shared`

## 5) Создать и настроить backend env

Скопируй шаблон:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Открой `apps/backend/.env` и проверь ключевые переменные:

- `PORT=4000`
- `DATABASE_URL=postgresql://meeting_ai:meeting_ai@localhost:5432/meeting_ai?schema=public`
- `JWT_SECRET=change_me` (замени на свое безопасное значение)
- `REDIS_URL=redis://localhost:6379`
- `UPLOAD_DIR=./uploads`
- `MAX_MEETING_MINUTES=120`
- `TRANSCRIPTION_PROVIDER=mock`
- `POSTPROCESSING_PROVIDER=mock`
- `TELEGRAM_BOT_TOKEN=` (опционально)
- `SMTP_HOST=localhost`
- `SMTP_PORT=1025`
- `SMTP_FROM=meeting-ai@example.local`

Рекомендуемый старт для MVP:

- оставить `TRANSCRIPTION_PROVIDER=mock`
- оставить `POSTPROCESSING_PROVIDER=mock`

Так проект запустится без платных AI API.

## 6) Подготовить Prisma

Сгенерировать Prisma Client:

```bash
pnpm --filter @meeting-ai/backend prisma:generate
```

Применить миграции:

```bash
pnpm --filter @meeting-ai/backend prisma:migrate
```

При необходимости можно сидировать данные:

```bash
pnpm --filter @meeting-ai/backend prisma:seed
```

## 7) Запустить backend API

В отдельном терминале:

```bash
cd "/Users/rushan/python/codex/My meeting AI"
pnpm dev:backend
```

Ожидаем API на `http://localhost:4000`.

## 8) Запустить worker (обязательно)

Worker обрабатывает очередь pipeline (transcription/summary/tasks и т.д.).

Во втором терминале:

```bash
cd "/Users/rushan/python/codex/My meeting AI"
pnpm --filter @meeting-ai/backend dev:worker
```

Без worker загрузка файлов будет приниматься, но обработка не пойдет.

## 9) Запустить frontend

В третьем терминале:

```bash
cd "/Users/rushan/python/codex/My meeting AI"
pnpm dev:frontend
```

Открыть в браузере:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`

## 10) Быстрый smoke test (основной сценарий)

1. Открыть `http://localhost:5173`
2. Зарегистрироваться (`/register`) или войти (`/login`)
3. Создать meeting на экране `/meetings`
4. Открыть meeting details
5. Загрузить аудио/видео файл
6. Убедиться, что файл длиной >120 минут отклоняется понятной ошибкой
7. Подождать завершения pipeline
8. Проверить в details:
   - transcript
   - speakers
   - summary
   - tasks
   - Q&A
9. Проверить export:
   - transcript.txt download
   - export email/telegram
10. Проверить admin:
   - `/admin/runs` список run-ов
   - `/admin/runs/:runId` детали, шаги, ошибки, стоимость, rerun
   - `/admin/models` смена transcription/postprocessing моделей

## 11) Где смотреть почту и логи

- Mailpit UI (локально) обычно на `http://localhost:8025` (если не меняли docker-compose)
- API logs — терминал с `pnpm dev:backend`
- Worker logs — терминал с `pnpm --filter @meeting-ai/backend dev:worker`

## 12) Полезные команды во время разработки

Type check backend:

```bash
pnpm --filter @meeting-ai/backend lint
```

Type check frontend:

```bash
pnpm --filter @meeting-ai/frontend lint
```

Сборка всего monorepo:

```bash
pnpm build
```

## 13) Если что-то не работает

### Проблема: не подключается к БД

- Проверь, что docker-контейнер Postgres поднят
- Проверь `DATABASE_URL` в `apps/backend/.env`
- Повтори миграции

### Проблема: обработка не запускается

- Проверь, что Redis поднят
- Проверь, что worker запущен
- Смотри ошибки в worker логах

### Проблема: экспорт email не работает

- Проверь `SMTP_HOST/SMTP_PORT`
- Для локали оставь Mailpit

### Проблема: export telegram не работает

- Укажи `TELEGRAM_BOT_TOKEN`
- Проверь корректный `chat_id`

### Проблема: paid AI не работает

- В текущем MVP OpenAI adapters помечены как stub (не реализованы)
- Для стабильной локальной работы используй `mock` провайдеры

## 14) Что важно помнить

- Для полного flow всегда нужны 3 процесса: API + worker + frontend.
- `MAX_MEETING_MINUTES` регулирует лимит загрузки длительности.
- Исходные файлы хранятся временно и удаляются в процессе pipeline.
- Admin-раздел рассчитан как internal tool (без отдельной enterprise RBAC панели).
