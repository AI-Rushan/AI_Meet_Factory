# Data Model — актуально на 2026-05-30

## Personal-first / Team-ready

- У каждого `User` есть ровно один личный `Workspace` через `Workspace.personalOwnerUserId` (unique).
- Команды — `Workspace.kind = TEAM` + строки `Membership`.
- Каждая `Meeting` принадлежит ровно одному `Workspace`.

## Пользовательский контур

| Сущность | Назначение |
|---|---|
| `User` | Аккаунт пользователя |
| `Workspace` | Рабочее пространство (PERSONAL / TEAM) |
| `Membership` | Связь User ↔ Workspace с ролью (OWNER / MEMBER) |
| `Meeting` | Встреча. Статусы: CREATED → PROCESSING → READY / FAILED |
| `Transcript` | Транскрипция: rawText + language |
| `TranscriptSegment` | Сегмент: startSec, endSec, text, segmentOrder, speakerId |
| `Speaker` | autoLabel / suggestedName / confirmedName |
| `Summary` | JSON `{topics, decisions}` в поле `text` |
| `TaskItem` | AI-черновик + финальные значения; `done: Boolean` |
| `MeetingQuestion` | Вопросы Q&A по встрече |
| `ExportLog` | Факт экспорта (target: TELEGRAM/EMAIL) |

## Биллинг

| Сущность | Назначение |
|---|---|
| `Plan` | Тарифный план: цены (руб), лимиты (minutesPerMonth, meetingsPerMonth), storageDays, gracePeriodDays |
| `Subscription` | Подписка: planId, status, expiresAt, gracePeriodEndsAt, cancelledAt, cancelReason |
| `Payment` | Ручная запись платежа: amount (руб), status (success/failed/refunded) |
| `UsageRecord` | Потребление за период (YYYY-MM): audioMinutes, meetingsCount, *CostUsd |

## Служебный контур

| Сущность | Назначение |
|---|---|
| `AIModelConfig` | purpose (transcription/postprocessing), provider, model, isActive |
| `MeetingProcessingRun` | Один запуск обработки: модели, totalCost, статус |
| `ProcessingStepLog` | Детальный лог каждого шага: provider, model, cost, error, duration |
| `TelegramContact` | Telegram-пользователи, написавшие боту /start |

## Поля модели User

| Поле | Тип | Назначение |
|---|---|---|
| `email` | String unique | Логин |
| `passwordHash` | String | bcrypt-хэш пароля |
| `emailVerified` | Boolean | Подтверждён ли email (false = не может войти) |
| `emailVerifyToken` | String? unique | Токен верификации (24 ч) |
| `isAdmin` | Boolean | Доступ к admin-панели |
| `isBlocked` | Boolean | Заблокирован — не может войти |
| `isArchivist` | Boolean | Системный аккаунт для хранения данных удалённых пользователей |
| `accountType` | AccountType | INDIVIDUAL / CORPORATE |
| `loginCount` | Int | Счётчик успешных входов |
| `lastActiveAt` | DateTime? | Обновляется при каждом GET /auth/session |
| `passwordResetToken` | String? unique | Токен сброса пароля (15 мин) |

## Поля модели Workspace

| Поле | Назначение |
|---|---|
| `personalOwnerUserId` | unique — личный владелец; null у архивных workspace |
| `originalOwnerEmail` | Email удалённого пользователя (бывшего владельца) |
| `kind` | PERSONAL / TEAM |

## Статусы подписки (SubscriptionStatus)

| Статус | Описание |
|---|---|
| `free` | Бесплатный тариф навсегда |
| `trial` | Пробный период |
| `active` | Оплаченная подписка действует |
| `grace` | Льготный период после истечения |
| `expired` | Подписка и grace-период истекли |
| `canceled` | Отменена вручную |

## Ключевые инварианты

- `Summary.text` — JSON строка `{"topics": [...], "decisions": [...]}`. Если не JSON — отображается как plain text.
- `TaskItem` хранит AI-значение (`auto*`) и пользовательское (`final*`).
- `AIModelConfig` — несколько конфигов одного `purpose`; активный: `findFirst({ where: { purpose, isActive: true } })`.
- Исходный файл удаляется после успешной транскрипции (worker, шаг `source_deleted`).
- При удалении пользователя встречи переносятся к архивариусу, workspace получает `personalOwnerUserId=null`.
- `Payment.amount` — в рублях. `UsageRecord.*CostUsd` — себестоимость в долларах (только для внутренней аналитики).
- Пользователи, созданные через admin-панель, получают `emailVerified=true` автоматически.
