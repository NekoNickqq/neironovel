# Деплой RP Novel Engine на сервер

Пошаговая схема для VPS (Ubuntu 22.04/24.04). Предполагается:

- **Сервер приложения** — CPU, nginx, FastAPI, статика frontend, опционально Ollama.
- **GPU-сервер** (может быть тот же или отдельный) — ComfyUI для картинок.

Домен в примерах: `novel.example.com`. Замени на свой.

---

## 1. Обзор production-схемы

```
Интернет
   │
   ▼
nginx :443
   ├── /          → статика (dist/)
   ├── /api/      → proxy → uvicorn :8000
   ├── /gallery/  → proxy → backend (статика)
   └── /avatars/  → proxy → backend (статика)

Backend (FastAPI) ──→ Ollama (localhost:11434 или другой хост)
                 └──→ ComfyUI (GPU-хост:1215)
```

SQLite и файлы галереи лежат на диске backend: `backend/data/`, `backend/gallery/`, `backend/avatars/`.

---

## 2. Требования к серверу

| Компонент | Минимум |
|-----------|---------|
| App VPS | 2 vCPU, 4 GB RAM, 20 GB SSD |
| Ollama (26B) | 32+ GB RAM или GPU с достаточной VRAM |
| ComfyUI | NVIDIA GPU, отдельная машина или тот же сервер с GPU |

Установи базовые пакеты:

```bash
sudo apt update
sudo apt install -y git curl nginx certbot python3-certbot-nginx \
  python3 python3-venv python3-pip build-essential
```

Node.js 20 LTS (для сборки frontend на сервере или собирай локально и заливай `dist/`):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

---

## 3. Пользователь и каталог

```bash
sudo adduser --disabled-password --gecos "" novel
sudo usermod -aG sudo novel   # опционально
sudo mkdir -p /var/www/neironovel
sudo chown novel:novel /var/www/neironovel
```

Переключись на пользователя:

```bash
sudo su - novel
cd /var/www/neironovel
```

---

## 4. Клонирование и установка

```bash
git clone <url-репозитория> .
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
mkdir -p data gallery avatars
deactivate
cd ..

npm ci
npm run build
```

Проверка сборки:

```bash
ls -la dist/
```

---

## 5. Production-конфиг backend

```bash
nano /var/www/neironovel/backend/.env
```

Пример для одного VPS (Ollama локально, ComfyUI на GPU-машине в той же сети):

```env
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=huihui_ai/gemma-4-abliterated:26b
OLLAMA_TIMEOUT=300

COMFYUI_URL=http://10.0.0.5:1215
COMFYUI_WORKFLOW=workflow.json
COMFYUI_TIMEOUT=180

DATABASE_PATH=/var/www/neironovel/backend/data/novel.db
GALLERY_PATH=/var/www/neironovel/backend/gallery
AVATARS_PATH=/var/www/neironovel/backend/avatars

HOST=127.0.0.1
PORT=8000
```

`HOST=127.0.0.1` — backend только за nginx, не торчит наружу.

Ручной тест:

```bash
cd /var/www/neironovel/backend
source venv/bin/activate
python main.py
# в другом SSH: curl -s http://127.0.0.1:8000/docs | head
```

---

## 6. systemd для backend

```bash
sudo nano /etc/systemd/system/neironovel-api.service
```

```ini
[Unit]
Description=RP Novel Engine API
After=network.target

[Service]
Type=simple
User=novel
Group=novel
WorkingDirectory=/var/www/neironovel/backend
Environment=PYTHONUNBUFFERED=1
ExecStart=/var/www/neironovel/backend/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable neironovel-api
sudo systemctl start neironovel-api
sudo systemctl status neironovel-api
journalctl -u neironovel-api -f
```

---

## 7. Ollama на сервере (опционально)

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable ollama
sudo systemctl start ollama
ollama pull huihui_ai/gemma-4-abliterated:26b
curl http://127.0.0.1:11434/api/tags
```

Если Ollama на другой машине — укажи её URL в `OLLAMA_URL`.

---

## 8. ComfyUI на GPU-хосте

На машине с GPU (может быть не тот же VPS):

```bash
# установка ComfyUI — по официальной инструкции проекта
cd /opt/ComfyUI
python main.py --listen 0.0.0.0 --port 1215
```

Production: отдельный systemd-unit или screen/tmux, firewall — открыть `1215` **только** для IP app-сервера:

```bash
sudo ufw allow from <APP_SERVER_IP> to any port 1215
```

Скопируй `backend/workflow.json` на GPU-хост, если ComfyUI ожидает те же узлы/модели.

---

## 9. nginx

```bash
sudo nano /etc/nginx/sites-available/neironovel
```

```nginx
server {
    listen 80;
    server_name novel.example.com;

    root /var/www/neironovel/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location /gallery/ {
        proxy_pass http://127.0.0.1:8000/gallery/;
        proxy_set_header Host $host;
    }

    location /avatars/ {
        proxy_pass http://127.0.0.1:8000/avatars/;
        proxy_set_header Host $host;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host $host;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host $host;
    }
}
```

> **Примечание:** префикс `/api/` в nginx с `proxy_pass .../` убирает `/api` при проксировании. Когда фронтенд начнёт ходить в API, базовый URL должен быть согласован (например `VITE_API_URL=/api` при сборке). Сейчас UI на mock — nginx готов под будущую интеграцию.

```bash
sudo ln -sf /etc/nginx/sites-available/neironovel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 10. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d novel.example.com
sudo certbot renew --dry-run
```

---

## 11. Firewall на app-сервере

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 12. Обновление релиза

```bash
sudo su - novel
cd /var/www/neironovel

git pull origin main

source backend/venv/bin/activate
pip install -r backend/requirements.txt
deactivate

npm ci
npm run build

sudo systemctl restart neironovel-api
sudo systemctl reload nginx
```

---

## 13. Бэкапы

Данные, которые нужно сохранять:

```bash
/var/www/neironovel/backend/data/novel.db
/var/www/neironovel/backend/gallery/
/var/www/neironovel/backend/avatars/
/var/www/neironovel/backend/.env
```

Пример cron (ежедневно):

```bash
tar -czf /backup/neironovel-$(date +%F).tar.gz \
  -C /var/www/neironovel/backend data gallery avatars .env
```

---

## 14. Мониторинг и логи

```bash
journalctl -u neironovel-api -n 100 --no-pager
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Проверка здоровья (может ждать Ollama/ComfyUI):

```bash
curl -s http://127.0.0.1:8000/health | python3 -m json.tool
```

---

## 15. Альтернатива: Docker (кратко)

Если позже появится `Dockerfile`:

1. Образ backend: `python:3.12-slim`, `pip install -r requirements.txt`, volume для `data/`, `gallery/`, `avatars/`.
2. Образ frontend: multi-stage `node build` → `nginx:alpine` с `dist/`.
3. Ollama — официальный образ `ollama/ollama`.
4. ComfyUI — отдельный GPU-контейнер или bare metal.

Пока в репозитории нет готовых Dockerfile — используй systemd + nginx выше.

---

## 16. Чеклист перед открытием наружу

- [ ] `backend/.env` с production URL, без dev IP коллеги
- [ ] Backend слушает только `127.0.0.1`
- [ ] HTTPS включён
- [ ] ComfyUI не доступен из интернета без VPN/firewall
- [ ] Бэкапы SQLite и галереи
- [ ] Модель Ollama скачана на сервере
- [ ] После подключения фронта к API — CORS и `allow_origins` в `main.py` под домен production
