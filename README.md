# Meeting AI

SaaS-сервис для асинхронной работы со встречами: загрузка аудио/видео → транскрипция → саммари → задачи → Q&A → экспорт.

## Структура репозитория

```
apps/
  backend/   — Express API + BullMQ worker + Prisma
  frontend/  — React + Vite UI
packages/
  shared/    — общие типы, спецификация (PROJECT_SPEC.md)
infra/       — docker-compose (PostgreSQL, Redis, Mailpit)
docs/        — API reference, архитектура, модель данных
```

## Требования

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

## Быстрый старт

### 1. Запустить инфраструктуру

```bash
docker compose -f infra/docker-compose.yml up -d
```

Поднимает: PostgreSQL · Redis · Mailpit (SMTP для email-экспорта).

### 2. Установить зависимости

```bash
pnpm install
```

### 3. Настроить переменные окружения

```bash
cp apps/backend/.env.example apps/backend/.env
```

Обязательные поля в `apps/backend/.env`:

```env
DATABASE_URL=postgresql://meeting_ai:meeting_ai@localhost:5432/meeting_ai
JWT_SECRET=<случайная строка>
REDIS_URL=redis://localhost:6379
```

Провайдеры AI (выбрать хотя бы один для транскрипции и постобработки):

```env
TRANSCRIPTION_PROVIDER=groq       # groq | openai | gemini | deepgram | assemblyai | gladia | mock
POSTPROCESSING_PROVIDER=openai    # openai | mock

GROQ_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
DEEPGRAM_API_KEY=...
ASSEMBLYAI_API_KEY=...
GLADIA_API_KEY=...
```

Для экспорта:

```env
TELEGRAM_BOT_TOKEN=...   # Telegram бот для отправки результатов
SMTP_HOST=localhost       # Mailpit из docker работает без настройки
```

### 4. Применить миграции

```bash
pnpm --filter @meeting-ai/backend prisma:generate
pnpm --filter @meeting-ai/backend prisma:migrate
```

### 5. Запустить

```bash
# Backend API (порт 4000)
pnpm dev:backend

# Worker (в отдельном терминале)
pnpm --filter @meeting-ai/backend dev:worker

# Frontend (порт 5173)
pnpm dev:frontend
```

## Основной сценарий

1. Зарегистрироваться / войти
2. Создать встречу
3. Загрузить аудио/видео файл (до 120 минут)
4. Дождаться завершения обработки (транскрипция → спикеры → саммари → задачи)
5. В карточке встречи:
   - Просмотреть транскрипцию, переименовать спикеров
   - Получить саммари (темы + решения) и задачи
   - Задать вопрос ИИ по содержанию встречи
   - Экспортировать в Telegram или Email
6. Повторно открывать встречу в любое время

## Провайдеры транскрипции

| Провайдер | Модель | Цена | Диаризация |
|---|---|---|---|
| `groq` | whisper-large-v3-turbo | бесплатно (лимит 7200с/час) | нет |
| `openai` | whisper-1 | $0.006/мин | нет |
| `gemini` | gemini-2.0-flash | ~$0.10/1M токенов | да |
| `deepgram` | nova-3 | $0.0059/мин | да |
| `assemblyai` | best | $0.0062/мин | да |
| `gladia` | solaria-1 | бесплатно 10ч/мес | да |
| `mock` | — | бесплатно | нет (для разработки) |

Все провайдеры автоматически определяют количество каналов аудио и используют multichannel-режим при channels > 1.

## Admin-панель (для разработчика)

Доступна пользователям с флагом `isAdmin`:

- `/admin/runs` — журнал обработок с фильтрами (статус, пользователь, дата, ошибки)
- `/admin/runs/:runId` — детали запуска, шаги, стоимость, ручной перезапуск
- `/admin/models` — переключение активных AI-моделей без изменения кода
- `/admin/users` — управление пользователями

## Документация

- `docs/api.md` — все API-эндпоинты
- `docs/architecture.md` — архитектура, pipeline, провайдеры
- `docs/data-model.md` — схема данных и инварианты
- `packages/shared/PROJECT_SPEC.md` — техническое задание V1
