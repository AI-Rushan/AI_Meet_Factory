# Architecture — актуально на 2026-05-30

## Stack

- **Monorepo**: pnpm workspace (`apps/frontend`, `apps/backend`, `packages/shared`)
- **Backend**: Node.js + TypeScript + Express + Prisma + PostgreSQL + Redis + BullMQ
- **Frontend**: React + TypeScript + Vite + React Router + TanStack Query (весь UI в одном `App.tsx`)
- **Auth**: email/password + JWT Bearer token; email-верификация при регистрации
- **Queue**: BullMQ worker — обработка встреч в фоне с retry
- **AI adapters**: factory-паттерн, замена без изменения кода
- **Process manager**: PM2 (продакшн) — `meeting-ai-api` + `meeting-ai-worker`

## Модули бэкенда

| Модуль | Файлы |
|---|---|
| Auth | `routes/auth.ts`, `services/authService.ts` |
| Meetings (user) | `routes/meetings.ts`, `services/meetingsService.ts` |
| Admin | `routes/admin.ts` |
| Processing worker | `src/worker.ts`, `services/processingPipeline.ts` |
| Transcription adapters | `services/transcription/providers/` |
| Postprocessing adapters | `services/postprocessing/providers/` |
| Export | `services/exportService.ts` |
| File duration | `services/fileDuration.ts` (ffprobe-static) |
| Email | `lib/mailer.ts` (SMTP или Resend API) |

## Auth flow

```
Регистрация:
POST /auth/register → создать User + Workspace + Membership
  → отправить письмо с токеном верификации (24ч)
  → вернуть { pending: true }

Верификация email:
GET /auth/verify-email?token=... → emailVerified=true, loginCount++, lastActiveAt=now
  → вернуть JWT

Вход:
POST /auth/login → проверить пароль + emailVerified + isBlocked
  → loginCount++, lastActiveAt=now → вернуть JWT
```

## AI-контуры

```
Контур 1 — Транскрипция
AIModelConfig (purpose="transcription", isActive=true)
→ TranscriptionAdapter: groq | openai | gemini | deepgram | assemblyai | gladia | mock

Контур 2 — Постобработка (единый провайдер для всех операций)
AIModelConfig (purpose="postprocessing", isActive=true)
→ PostprocessingAdapter: openai | mock
   ├─ summarize()            → { topics: string[], decisions: string[] }
   ├─ extractTasks()         → ExtractedTask[]
   ├─ suggestSpeakerNames()
   └─ answerQuestion()
```

## Pipeline обработки (BullMQ)

```
upload → ffprobe duration check → MeetingProcessingRun (pending)
→ worker:
   file_received
   transcription_requested
   transcription_completed  → Transcript + TranscriptSegment saved
   source_deleted           → исходный файл удалён
   speakers_identified      → Speaker rows upserted
   summary_completed        → Summary upserted
   tasks_extracted          → TaskItem rows created
   meeting_qa_prepared      → подготовка контекста для Q&A
   results_saved
   processing_completed     → Meeting.status = READY
```

> Worker обязателен — без него задачи висят в очереди Redis и не обрабатываются.

## Multichannel detection

Перед транскрипцией все провайдеры вызывают `getAudioChannels(filePath)` через ffprobe:
- channels > 1 → multichannel-режим (точная диаризация по каналам)
- channels = 1 → diarize по голосу / SPEAKER_1 для Whisper

## Summary format

`Summary.text` хранит JSON `{ topics: string[], decisions: string[] }`.
При рендере: `parseSummary()` — если не JSON, показывает как plain text (обратная совместимость).
При экспорте: `renderMeetingText()` парсит JSON → форматирует пунктами `•`.

## Telegram export flow

1. Получатели пишут боту `/start` один раз
2. `POST /me/meetings/telegram/contacts/refresh` → `getUpdates(limit=100)` → upsert в `TelegramContact`
3. Пользователь выбирает получателей → `POST /me/meetings/:id/export { target: "TELEGRAM", chatIds: [...] }`
4. `exportToTelegram()` → sendMessage для каждого chatId

## Архивариус

Системный аккаунт `archivist@system.internal` (`isArchivist=true`, `isBlocked=true`).
При удалении пользователя:
- Встречи переносятся к архивариусу (`createdByUserId = archivist.id`)
- Workspace удалённого получает `personalOwnerUserId=null`, `originalOwnerEmail=email`
- Архивариус получает OWNER-членство в этом workspace

Переназначение в `/admin/archive`: встречи перемещаются в личный workspace целевого пользователя.

## Биллинг (физлица)

```
Plan → Subscription (userId, planId, status, expiresAt, gracePeriodEndsAt)
     → Payment (ручная фиксация, amount в рублях)
     → UsageRecord (period="YYYY-MM", audioMinutes, *CostUsd)
```

Статусы подписки: `free` → `trial` → `active` → `grace` → `expired` / `canceled`

## Admin pages

- `/admin/dashboard` — аналитика: карточки итогов + таблица по пользователям (встречи, часы, AI-стоимость, оплачено)
- `/admin/runs` — журнал обработок с фильтрами
- `/admin/runs/:runId` — карточка запуска, кнопка перезапуска
- `/admin/models` — настройки AI-моделей
- `/admin/users` — управление пользователями (создание, редактирование, блокировка, удаление)
- `/admin/subscriptions` — ручное назначение подписок, история, отмена
- `/admin/archive` — workspace-сироты удалённых пользователей, переназначение встреч
