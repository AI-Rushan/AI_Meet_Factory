# API Reference — актуально на 2026-05-30

Base URL: `http://localhost:4000/api` (локально) / `https://app.sense-ai.ru/api` (продакшн)

Защищённые эндпоинты требуют заголовок: `Authorization: Bearer <token>`

---

## Auth

| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/register` | Регистрация → письмо верификации, возвращает `{ pending: true }` |
| GET | `/auth/verify-email?token=` | Подтверждение email → возвращает JWT |
| POST | `/auth/login` | Вход → JWT. Блокируется если `emailVerified=false` или `isBlocked=true` |
| GET | `/auth/session` | Текущая сессия; обновляет `lastActiveAt` |
| POST | `/auth/forgot-password` | Письмо со ссылкой сброса пароля (15 мин) |
| POST | `/auth/reset-password` | Сбросить пароль `{ token, password }` |

---

## Meetings (пользовательский контур)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/me/meetings` | Список встреч. Параметры: `search`, `status` |
| POST | `/me/meetings` | Создать встречу `{ title }` |
| GET | `/me/meetings/:id` | Карточка (transcript / speakers / summary / tasks / questions / runs) |
| PATCH | `/me/meetings/:id` | Обновить `title` / `status` |
| DELETE | `/me/meetings/:id` | Удалить встречу |
| POST | `/me/meetings/:id/upload` | Загрузить аудио/видео (multipart), запустить обработку |
| GET | `/me/meetings/:id/transcript.txt` | Скачать транскрипцию `[HH:MM:SS] Спикер: текст` |
| PATCH | `/me/meetings/:id/transcript` | Обновить сегменты транскрипции |
| POST | `/me/meetings/:id/speakers` | Добавить спикера вручную |
| PATCH | `/me/meetings/:id/speakers/:speakerId` | Задать `confirmedName` спикеру |
| POST | `/me/meetings/:id/summary` | Сгенерировать саммари |
| POST | `/me/meetings/:id/tasks/extract` | Извлечь задачи из транскрипции |
| POST | `/me/meetings/:id/tasks` | Создать задачу вручную |
| PATCH | `/me/meetings/:id/tasks/:taskId` | Изменить задачу |
| DELETE | `/me/meetings/:id/tasks/:taskId` | Удалить задачу |
| POST | `/me/meetings/:id/questions` | Задать вопрос по встрече `{ question }` |
| POST | `/me/meetings/:id/export` | Экспорт `{ target: "EMAIL"\|"TELEGRAM", destination?, chatIds? }` |
| GET | `/me/meetings/telegram/contacts` | Список Telegram-контактов |
| POST | `/me/meetings/telegram/contacts/refresh` | Опросить бота, обновить контакты |

---

## Admin

Все роуты требуют `isAdmin=true` в JWT.

### Дашборд

| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/dashboard` | Итоги + таблица пользователей с метриками (встречи, часы, AI-стоимость, оплата) |

### Журнал обработок

| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/runs` | Журнал. Фильтры: `status`, `userId`, `userEmail`, `from`, `to`, `hasErrors` |
| GET | `/admin/runs/:runId` | Карточка запуска (шаги, провайдеры, стоимость, ошибки) |
| POST | `/admin/runs/:runId/rerun` | Ручной перезапуск |

### AI-модели

| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/models` | Все конфигурации AI-моделей |
| PUT | `/admin/models/transcription` | Активировать транскрипцию `{ provider, model }` |
| PUT | `/admin/models/postprocessing` | Активировать постобработку `{ provider, model }` |

### Пользователи

| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/users` | Список. Фильтр: `search`. Включает loginCount, lastActiveAt, isBlocked |
| POST | `/admin/users` | Создать (emailVerified=true автоматически) |
| PATCH | `/admin/users/:userId` | Обновить (email, name, isAdmin, isBlocked, password) |
| DELETE | `/admin/users/:userId` | Удалить → данные переносятся к архивариусу |
| GET | `/admin/users/:userId/subscriptions` | История подписок пользователя |
| POST | `/admin/users/:userId/subscriptions` | Назначить подписку вручную |

### Подписки и планы

| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/plans` | Список тарифных планов |
| GET | `/admin/subscriptions` | Все подписки. Фильтр: `status` |
| PATCH | `/admin/subscriptions/:subId` | Обновить (status, expiresAt, cancelReason, note) |
| POST | `/admin/payments` | Зафиксировать платёж `{ userId, subscriptionId?, amount, status, note? }` |

### Архивариус и workspace

| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/archivist/setup` | Проверить существование архивариуса |
| POST | `/admin/archivist/setup` | Создать архивариуса |
| GET | `/admin/workspaces` | Workspace-сироты удалённых пользователей |
| POST | `/admin/workspaces/:workspaceId/transfer` | Перенести встречи в workspace целевого пользователя `{ targetUserId }` |

---

## Форматы и поведение

### Загрузка файла

- Максимум 120 минут (или `MAX_MEETING_MINUTES` из env)
- При превышении — `400` с `{ maxMinutes, actualMinutes }`
- Поддерживаемые форматы: MP3, WAV, M4A, MP4, WebM, OGG, FLAC, AAC, MKV и другие через `application/octet-stream`

### Ошибки входа

| HTTP | error | Причина |
|---|---|---|
| 401 | Invalid credentials | Неверный пароль |
| 403 | EMAIL_NOT_VERIFIED | Email не подтверждён |
| 403 | USER_BLOCKED | Аккаунт заблокирован |

### Статусы встречи

```text
CREATED → PROCESSING → READY
                     → FAILED → PROCESSING (через rerun)
```

### Шаги обработки

```text
file_received → transcription_requested → transcription_completed →
source_deleted → speakers_identified → summary_completed →
tasks_extracted → meeting_qa_prepared → results_saved → processing_completed
```

### Провайдеры транскрипции

| Провайдер | Модель | Цена | Диаризация |
|---|---|---|---|
| groq | whisper-large-v3-turbo | бесплатно (7200с/час) | нет |
| openai | whisper-1 | $0.006/мин | нет |
| gemini | gemini-2.0-flash | ~$0.10/1M токенов | да |
| deepgram | nova-3 | $0.0059/мин | да |
| assemblyai | best | $0.0062/мин | да |
| gladia | solaria-1 | бесплатно 10ч/мес | да |
| mock | — | бесплатно | нет (разработка) |
