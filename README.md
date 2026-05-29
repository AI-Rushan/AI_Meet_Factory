# AI Meet Factory

SaaS-сервис для транскрибации и анализа встреч: загрузка аудио/видео → транскрипция → саммари → задачи → Q&A → экспорт.

Продакшн: **https://app.sense-ai.ru**

## Структура репозитория

```
apps/
  backend/   — Express API + BullMQ worker + Prisma
  frontend/  — React + Vite SPA (весь UI в App.tsx)
packages/
  shared/    — общие типы, спецификация (PROJECT_SPEC.md)
infra/       — docker-compose (PostgreSQL, Redis, Mailpit)
docs/        — API reference, архитектура, модель данных
ecosystem.config.cjs — PM2 конфиг для продакшна
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

Поднимает: PostgreSQL · Redis · Mailpit (локальный SMTP, UI на порту 8025).

### 2. Установить зависимости

```bash
pnpm install
```

### 3. Настроить переменные окружения

```bash
cp apps/backend/.env.example apps/backend/.env
```

Обязательные поля:

```env
DATABASE_URL=postgresql://meeting_ai:meeting_ai@localhost:5432/meeting_ai
JWT_SECRET=<случайная строка>
REDIS_URL=redis://localhost:6379
APP_URL=http://localhost:5173
```

Провайдеры AI (выбрать хотя бы один):

```env
TRANSCRIPTION_PROVIDER=mock       # groq | openai | gemini | deepgram | assemblyai | gladia | mock
POSTPROCESSING_PROVIDER=mock      # openai | mock

GROQ_API_KEY=...
OPENAI_API_KEY=...
```

Email (для верификации аккаунтов):

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=meeting-ai@example.local
```

### 4. Применить миграции

```bash
pnpm --filter @meeting-ai/backend prisma:migrate
```

### 5. Запустить всё одной командой

```bash
pnpm dev:all
```

Запускает backend API (порт 4000) + worker + frontend (порт 5173).

> **Важно:** worker обязателен — без него транскрибация не запустится.

## Основной сценарий

1. Зарегистрироваться → подтвердить email по ссылке из письма
2. Войти и создать встречу
3. Загрузить аудио/видео файл (до 120 минут)
4. Дождаться обработки (транскрипция → спикеры → саммари → задачи)
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

## Admin-панель

Доступна пользователям с флагом `isAdmin`:

- `/admin/dashboard` — аналитика по всем пользователям
- `/admin/runs` — журнал обработок
- `/admin/models` — переключение AI-моделей
- `/admin/users` — управление пользователями
- `/admin/subscriptions` — управление подписками вручную
- `/admin/archive` — workspace удалённых пользователей

## Документация

- `docs/api.md` — все API-эндпоинты
- `docs/architecture.md` — архитектура, pipeline, провайдеры
- `docs/data-model.md` — схема данных
- `docs/deployment.md` — деплой на VPS
- `PROJECT_RUN.md` — запуск локально
