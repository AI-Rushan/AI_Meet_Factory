# Подключение к серверу (VPS Xorek.cloud)

## Параметры сервера

| Параметр | Значение |
|----------|----------|
| IP-адрес | `150.241.107.20` |
| Домен | `1303751.hosted-by.xorek.cloud` (DNS может не работать — используй IP) |
| Пользователь | `root` |
| Пароль SSH | `Ruhmen78` |
| Пароль панели управления | `szUJgg35564W` |
| Панель управления | https://vm.xorek.cloud |

---

## 1. Подключение через SSH (терминал)

### macOS / Linux

```bash
ssh root@150.241.107.20
# Введи пароль: Ruhmen78
```

Если SSH отклоняет пароль, убедись что параметр `PasswordAuthentication` включён. Используй sshpass для неинтерактивного подключения:

```bash
# Установи sshpass (macOS)
brew install sshpass

# Подключение без ввода пароля
sshpass -p 'Ruhmen78' ssh root@150.241.107.20
```

### Windows

Используй **PuTTY**:
1. Скачай PuTTY: https://putty.org
2. Host Name: `150.241.107.20`, Port: `22`
3. Connection → SSH → Auth → введи пароль при подключении

Или **Windows Terminal** (встроенный SSH):
```
ssh root@150.241.107.20
```

---

## 2. Подключение через веб-консоль (без SSH)

Если SSH недоступен — используй VNC-консоль в панели управления:

1. Зайди на https://vm.xorek.cloud
2. Логин/пароль от аккаунта Xorek.cloud
3. Выбери свою VM → кнопка **"Консоль"** или **"VNC"**
4. Откроется браузерный терминал — войди как `root` / `Ruhmen78`

---

## 3. Добавление SSH-ключа (рекомендуется)

Чтобы не вводить пароль при каждом подключении:

```bash
# На своём компьютере — сгенерировать ключ (если нет)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Скопировать ключ на сервер
ssh-copy-id root@150.241.107.20
# Введи пароль: Ruhmen78

# После этого подключение без пароля:
ssh root@150.241.107.20
```

---

## 4. Основные команды после подключения

```bash
# Статус приложения
pm2 list

# Логи бэкенда
pm2 logs meeting-ai-api --lines 50

# Логи воркера
pm2 logs meeting-ai-worker --lines 50

# Перезапуск приложения
pm2 restart all

# Статус сервисов
systemctl status nginx
systemctl status postgresql
systemctl status redis-server

# Диск и память
df -h /
free -h
```

---

## 5. Расположение файлов на сервере

```
/opt/meeting-ai/              — корень проекта
├── apps/
│   ├── backend/              — бэкенд (Node.js + Prisma)
│   │   ├── .env              — переменные окружения
│   │   └── src/
│   └── frontend/
│       └── dist/             — собранный фронтенд (отдаётся Nginx)
├── uploads/                  — загруженные аудио-файлы
└── ecosystem.config.js       — конфигурация PM2

/etc/nginx/sites-available/meeting-ai  — конфиг Nginx
/var/log/meeting-ai/                   — логи приложения
```
