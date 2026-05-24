# Architecture — актуально на 2026-05-24

## Stack

- **Monorepo**: pnpm workspace (`apps/frontend`, `apps/backend`, `packages/shared`)
- **Backend**: Node.js + TypeScript + Express + Prisma + PostgreSQL + Redis + BullMQ
- **Frontend**: React + TypeScript + Vite + React Router + TanStack Query
- **Auth**: email/password + JWT access token (Bearer)
- **Queue**: BullMQ worker — обработка встреч в фоне с retry
- **AI adapters**: factory-паттерн, замена без изменения кода

## Модули бэкенда

| Модуль | Файлы |
|---|---|
| Auth | `routes/auth.ts` |
| Meetings (user) | `routes/meetings.ts` |
| Admin | `routes/admin.ts` |
| Processing worker | `worker/meetingWorker.ts`, `services/processingPipeline.ts` |
| Transcription adapters | `services/transcription/providers/` |
| Postprocessing adapters | `services/postprocessing/providers/` |
| Export | `services/exportService.ts` |
| File duration | `services/fileDuration.ts` (ffprobe-static) |

## AI-контуры (§18)

```
Контур 1 — Транскрипция
AIModelConfig (purpose="transcription", isActive=true)
→ TranscriptionAdapter: groq | openai | gemini | deepgram | assemblyai | gladia

Контур 2 — Постобработка (единый провайдер для всех операций)
AIModelConfig (purpose="postprocessing", isActive=true)
→ PostprocessingAdapter: openai | mock
   ├─ summarize()       → { topics: string[], decisions: string[] }
   ├─ extractTasks()    → ExtractedTask[]
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
   meeting_qa_prepared      → (подготовка контекста для Q&A)
   results_saved
   processing_completed     → Meeting.status = READY
```

## Multichannel detection

Перед транскрипцией все провайдеры вызывают `getAudioChannels(filePath)` через ffprobe:
- channels > 1 → multichannel-режим (точная диаризация по каналам)
- channels = 1 → diarize по голосу / SPEAKER_1 для Whisper

## Summary format

`Summary.text` хранит JSON `{ topics: string[], decisions: string[] }`.
- При рендере на фронте: `parseSummary()` — если не JSON, показывает как plain text (backward compat)
- При экспорте: `renderMeetingText()` парсит JSON → форматирует пунктами `•`

## Telegram export flow

1. Получатели пишут боту `/start` один раз
2. Пользователь нажимает «Обновить список» → `POST /me/meetings/telegram/contacts/refresh` → `getUpdates(limit=100)` → upsert в `TelegramContact`
3. Пользователь выбирает получателей по имени → `POST /me/meetings/:id/export { target: "TELEGRAM", chatIds: [...] }`
4. `exportToTelegram()` → цикл sendMessage для каждого chatId

## Admin panel (frontend routes)

- `/admin/runs` — журнал обработок с фильтрами
- `/admin/runs/:runId` — карточка запуска, кнопка перезапуска
- `/admin/models` — настройки AI-моделей (transcription + postprocessing)
- `/admin/users` — управление пользователями

## Платные компоненты (§35)

Допускаются только для AI-обработки:
- OpenAI Whisper, OpenAI GPT-4o-mini
- Deepgram, AssemblyAI

Бесплатные альтернативы:
- Groq (Whisper-large-v3-turbo, до 7200с/час)
- Gladia (10ч/мес бесплатно)
- Gemini (Flash, generous free tier)
