# Деплой приложения на VPS

Инструкция описывает полное развёртывание My Meeting AI на чистом сервере Ubuntu 24.04.  
Сервер: `150.241.107.20` (Xorek.cloud VPS).  
Адрес приложения: **https://app.sense-ai.ru**

---

## Требования к серверу

- Ubuntu 22.04 / 24.04
- 1+ vCPU, 2+ GB RAM, 10+ GB диска
- Открытые порты: 22 (SSH), 80 (HTTP), 443 (HTTPS)

---

## Шаг 1. Подключиться к серверу

```bash
ssh root@150.241.107.20
# Пароль: Ruhmen78
```

---

## Шаг 2. Установить системные зависимости

```bash
# Обновить пакеты
apt-get update -qq

# Установить базовые пакеты
apt-get install -y curl git nginx redis-server

# Установить Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Проверить версию
node --version   # v22.x.x

# Установить pnpm и PM2 глобально
npm install -g pnpm pm2

# Установить PostgreSQL
apt-get install -y postgresql

# Запустить сервисы
systemctl start postgresql && systemctl enable postgresql
systemctl start redis-server && systemctl enable redis-server
systemctl start nginx && systemctl enable nginx
```

---

## Шаг 3. Создать базу данных PostgreSQL

```bash
sudo -u postgres psql << 'SQL'
CREATE USER meeting_ai WITH PASSWORD 'meeting_ai';
CREATE DATABASE meeting_ai OWNER meeting_ai;
GRANT ALL PRIVILEGES ON DATABASE meeting_ai TO meeting_ai;
SQL
```

---

## Шаг 4. Клонировать репозиторий

```bash
git clone https://github.com/AI-Rushan/AI_Meet_Factory.git /opt/meeting-ai
cd /opt/meeting-ai

# Создать папку для загрузок
mkdir -p /opt/meeting-ai/uploads
mkdir -p /var/log/meeting-ai
```

---

## Шаг 5. Создать файл окружения бэкенда

```bash
cat > /opt/meeting-ai/apps/backend/.env << 'EOF'
PORT=4000
DATABASE_URL=postgresql://meeting_ai:meeting_ai@localhost:5432/meeting_ai?schema=public
JWT_SECRET=замени_на_случайную_строку_32_символа
REDIS_URL=redis://localhost:6379
UPLOAD_DIR=/opt/meeting-ai/uploads
MAX_MEETING_MINUTES=120
TRANSCRIPTION_PROVIDER=mock
POSTPROCESSING_PROVIDER=mock

# API-ключи (заполни своими)
GROQ_API_KEY=gsk_...
ASSEMBLYAI_API_KEY=...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
DEEPGRAM_API_KEY=...
GLADIA_API_KEY=...
RESEND_API_KEY=re_...
SMTP_FROM=onboarding@resend.dev
TELEGRAM_BOT_TOKEN=...
APP_URL=http://150.241.107.20
EOF
```

---

## Шаг 6. Создать файл окружения фронтенда

```bash
# VITE_API_BASE_URL=/api — фронтенд обращается к /api, Nginx проксирует на бэкенд
echo 'VITE_API_BASE_URL=/api' > /opt/meeting-ai/apps/frontend/.env.production
```

---

## Шаг 7. Установить зависимости и собрать проект

```bash
cd /opt/meeting-ai

# Установить зависимости
pnpm install

# Собрать shared-пакет (нужен для бэкенда)
/opt/meeting-ai/node_modules/.pnpm/node_modules/.bin/tsc \
  -p /opt/meeting-ai/packages/shared/tsconfig.json

# Применить миграции БД
cd /opt/meeting-ai/apps/backend
npx prisma migrate deploy

# Собрать фронтенд
cd /opt/meeting-ai/apps/frontend
pnpm build
```

---

## Шаг 8. Настроить Nginx

```bash
cat > /etc/nginx/sites-available/meeting-ai << 'EOF'
server {
    listen 80;
    server_name 150.241.107.20 твой-домен.ru;

    # Фронтенд — статика
    root /opt/meeting-ai/apps/frontend/dist;
    index index.html;

    # API → бэкенд
    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        client_max_body_size 500m;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:4000;
    }

    # SPA — все маршруты → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Активировать конфиг
ln -sf /etc/nginx/sites-available/meeting-ai /etc/nginx/sites-enabled/meeting-ai
rm -f /etc/nginx/sites-enabled/default

# Проверить и перезапустить
nginx -t && systemctl restart nginx
```

---

## Шаг 9. Настроить PM2 (менеджер процессов)

```bash
TSX=/opt/meeting-ai/apps/backend/node_modules/.bin/tsx

cat > /opt/meeting-ai/ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: "meeting-ai-api",
      script: "src/index.ts",
      interpreter: "${TSX}",
      cwd: "/opt/meeting-ai/apps/backend",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      error_file: "/var/log/meeting-ai/api-error.log",
      out_file: "/var/log/meeting-ai/api-out.log"
    },
    {
      name: "meeting-ai-worker",
      script: "src/worker.ts",
      interpreter: "${TSX}",
      cwd: "/opt/meeting-ai/apps/backend",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      error_file: "/var/log/meeting-ai/worker-error.log",
      out_file: "/var/log/meeting-ai/worker-out.log"
    }
  ]
};
EOF

# Запустить
cd /opt/meeting-ai && pm2 start ecosystem.config.js

# Включить автозапуск при перезагрузке
pm2 save
pm2 startup systemd -u root --hp /root
systemctl enable pm2-root
```

---

## Шаг 10. Выдать права администратора первому пользователю

После регистрации на сайте выполни:

```bash
echo 'UPDATE "User" SET "isAdmin" = true WHERE email = $$твой@email.com$$;' \
  | sudo -u postgres psql -d meeting_ai
```

---

## Проверка работоспособности

```bash
# Статус процессов
pm2 list

# API отвечает напрямую
curl http://localhost:4000/health

# API через Nginx
curl http://localhost/health

# Фронтенд
curl -s http://localhost/ | head -3
```

Ожидаемый результат:
```
{"ok":true}
<!doctype html>
```

---

## Обновление приложения (повторный деплой)

```bash
cd /opt/meeting-ai

# Получить изменения из GitHub
git pull origin main

# Пересобрать shared-пакет (если изменился)
/opt/meeting-ai/node_modules/.pnpm/node_modules/.bin/tsc \
  -p /opt/meeting-ai/packages/shared/tsconfig.json

# Применить новые миграции БД
cd apps/backend && npx prisma migrate deploy && cd ../..

# Пересобрать фронтенд
cd apps/frontend && pnpm build && cd ../..

# Перезапустить бэкенд и воркер
pm2 restart all
```

---

## Диагностика проблем

| Симптом | Команда для диагностики |
|---------|------------------------|
| Сайт не открывается | `systemctl status nginx` |
| API не отвечает | `pm2 logs meeting-ai-api --lines 30` |
| Воркер не обрабатывает задачи | `pm2 logs meeting-ai-worker --lines 30` |
| Ошибка БД | `systemctl status postgresql` |
| Redis недоступен | `redis-cli ping` |
| Нет места на диске | `df -h /` |

```bash
# Перезапуск всего стека
systemctl restart postgresql redis-server nginx
pm2 restart all
```
