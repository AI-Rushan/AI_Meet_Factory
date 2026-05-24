# API Reference — актуально на 2026-05-24

Base URL: `http://localhost:4000/api`

## Auth

- `POST /auth/register` — регистрация + создание личного workspace
- `POST /auth/login` — вход
- `GET /auth/session` — текущая сессия по Bearer-токену

## Meetings (пользовательский контур)

- `GET /me/meetings` — список встреч текущего workspace
- `POST /me/meetings` — создать встречу `{ title }`
- `POST /me/meetings/:meetingId/upload` — загрузить аудио/видео (multipart), запустить обработку
- `GET /me/meetings/:meetingId` — карточка встречи (transcript / speakers / summary / tasks / questions / runs)
- `PATCH /me/meetings/:meetingId` — обновить `title` / `status` (с проверкой lifecycle)
- `GET /me/meetings/:meetingId/transcript.txt` — скачать транскрипцию
- `PATCH /me/meetings/:meetingId/transcript` — обновить сегменты транскрипции
- `POST /me/meetings/:meetingId/speakers` — добавить спикера
- `PATCH /me/meetings/:meetingId/speakers/:speakerId` — задать `confirmedName` спикеру
- `POST /me/meetings/:meetingId/summary` — сгенерировать саммари → вернуть `{topics, decisions}`
- `POST /me/meetings/:meetingId/tasks/extract` — извлечь задачи из транскрипции
- `POST /me/meetings/:meetingId/tasks` — создать задачу вручную
- `PATCH /me/meetings/:meetingId/tasks/:taskId` — изменить задачу (`finalText/finalAssignee/finalDueDate`)
- `DELETE /me/meetings/:meetingId/tasks/:taskId` — удалить задачу
- `POST /me/meetings/:meetingId/questions` — задать вопрос по встрече
- `POST /me/meetings/:meetingId/export` — экспорт `{ target: "EMAIL"|"TELEGRAM", destination?, chatIds? }`

## Telegram-контакты

- `GET /me/meetings/telegram/contacts` — список контактов из БД
- `POST /me/meetings/telegram/contacts/refresh` — опросить бота через getUpdates, обновить контакты в БД

## Admin / Developer

- `GET /admin/runs` — журнал обработок. Фильтры: `status`, `userId`, `userEmail`, `from`, `to`, `hasErrors`
- `GET /admin/runs/:runId` — карточка запуска (шаги, провайдеры, стоимость, ошибки)
- `POST /admin/runs/:runId/rerun` — ручной перезапуск (создаёт новый MeetingProcessingRun)
- `GET /admin/models` — все конфигурации AI-моделей
- `PUT /admin/models/transcription` — активировать модель транскрипции `{ provider, model }`
- `PUT /admin/models/postprocessing` — активировать модель постобработки `{ provider, model }`
- `GET /admin/users` — список пользователей (фильтр по email/name)
- `POST /admin/users` — создать пользователя
- `PATCH /admin/users/:userId` — обновить пользователя (email, name, isAdmin)
- `DELETE /admin/users/:userId` — удалить пользователя

## Шаги обработки (ProcessingStepLog.stepName)

```
file_received → transcription_requested → transcription_completed →
source_deleted → speakers_identified → summary_completed →
tasks_extracted → meeting_qa_prepared → results_saved → processing_completed
```

## Статусы встречи (lifecycle)

```
CREATED → PROCESSING → READY
                    → FAILED → PROCESSING
```

## Поведение при загрузке файла

- Максимум 120 минут (или `MAX_MEETING_MINUTES` из env).
- При превышении — `400` с `{ maxMinutes, actualMinutes }`, файл удаляется, обработка не запускается.
- Поддерживаемые MIME-типы: `audio/mpeg`, `audio/mp4`, `audio/m4a`, `audio/x-m4a`, `audio/wav`, `audio/ogg`, `audio/webm`, `audio/aac`, `audio/flac`, `audio/opus`, `video/mp4`, `video/quicktime`, `video/webm`.

## Формат транскрипции (.txt)

```
[HH:MM:SS] Имя спикера: текст
```

## Формат Summary

`Summary.text` — JSON строка:
```json
{ "topics": ["Тема 1", "Тема 2"], "decisions": ["Решение 1"] }
```
При экспорте автоматически форматируется в читаемый текст с пунктами `•`.

## Провайдеры транскрипции

| Провайдер | Модель | Цена | Диаризация |
|---|---|---|---|
| groq | whisper-large-v3-turbo | бесплатно | нет (SPEAKER_1) |
| openai | whisper-1 | $0.006/мин | нет (SPEAKER_1) |
| gemini | gemini-2.0-flash | ~$0.10/1M токенов | да (по голосу или каналам) |
| deepgram | nova-3 | $0.0059/мин | да |
| assemblyai | best | $0.0062/мин | да |
| gladia | solaria-1 | бесплатно до 10ч/мес | да |

Все провайдеры: при channels > 1 используют multichannel-режим (более точная диаризация).

## Провайдеры постобработки

| Провайдер | Модель | Операции |
|---|---|---|
| openai | gpt-4o-mini | summarize / extractTasks / suggestSpeakerNames / answerQuestion |
| mock | - | заглушка для разработки |
