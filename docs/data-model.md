# Data Model (MVP) — актуально на 2026-05-24

## Personal-first / Team-ready

- У каждого `User` есть ровно один личный `Workspace` через `Workspace.personalOwnerUserId` (unique).
- Команды — `Workspace.kind = TEAM` + строки `Membership`.
- Каждая `Meeting` принадлежит ровно одному `Workspace`.

## Все сущности

### Пользовательский контур

| Сущность | Назначение |
|---|---|
| `User` | Аккаунт. Поля: email, name, passwordHash, isAdmin |
| `Workspace` | Рабочее пространство (personal / team) |
| `Membership` | Связь User ↔ Workspace с ролью (OWNER / MEMBER) |
| `Meeting` | Встреча. Статусы: CREATED → PROCESSING → READY / FAILED |
| `Transcript` | Транскрипция: rawText + language |
| `TranscriptSegment` | Сегмент: startSec, endSec, text, segmentOrder, speakerId |
| `Speaker` | autoLabel / suggestedName / confirmedName |
| `Summary` | Хранит JSON `{topics: string[], decisions: string[]}` в поле `text`, имеет `version` |
| `TaskItem` | AI-черновик + финальные значения пользователя; `done: Boolean` |
| `MeetingQuestion` | Вопросы Q&A по встрече с ответами |
| `ExportLog` | Факт экспорта (target: TELEGRAM/EMAIL, destination, status) |
| `Subscription` | Подписка (planCode, billingPeriod, status, expiresAt) |

### Служебный контур

| Сущность | Назначение |
|---|---|
| `AIModelConfig` | purpose (transcription/postprocessing), provider, model, isActive |
| `MeetingProcessingRun` | Один запуск обработки; хранит фактические модели, стоимость, статус |
| `ProcessingStepLog` | Детальный лог каждого шага: provider, model, cost, error, duration |
| `TelegramContact` | Telegram-пользователи, написавшие боту /start (chatId, name, username) |

## Ключевые инварианты

- Транскрипция хранится структурировано: `Transcript` + упорядоченные строки `TranscriptSegment`.
- `Summary.text` — JSON строка `{"topics": [...], "decisions": [...]}`. При экспорте парсится в читаемый текст.
- `TaskItem` хранит и AI-автозаполненное значение (`auto*`), и финальное пользовательское (`final*`).
- `AIModelConfig` не имеет `@unique` на `purpose` — можно хранить несколько конфигов одного типа; активируется через `isActive = true`. Всегда использовать `findFirst({ where: { purpose, isActive: true } })`.
- Единый `postprocessing` провайдер для: саммари / задач / имён спикеров / Q&A.
- Исходный файл удаляется после успешной транскрипции (BullMQ worker).

## Известные отклонения от спецификации

1. **`Meeting.sourceType`** — вместо `source_type` используется `sourceMimeType` (строка типа `audio/mpeg`). Семантически эквивалентно, но форма другая.
2. **`TaskItem.status`** — вместо `status` (enum) используется `done: Boolean`. Отсутствуют промежуточные статусы.

## Personal workspace provisioning

- При регистрации `POST /auth/register` автоматически создаётся личный workspace и OWNER membership.
