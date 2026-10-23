# RP Novel Engine (neironovel)

Интерактивный движок для визуальных новелл с генерацией текста (Ollama) и изображений (ComfyUI).

## Что получит коллега после `git clone`

| Уровень | Что нужно | Результат |
|--------|-----------|-----------|
| **UI + API** | Python 3.10+, Node.js 18+, установка зависимостей (см. ниже) | Открывается интерфейс на **http://localhost:3000**, API на **http://localhost:8000** |
| **Полная генерация ИИ** | Дополнительно: Ollama с моделью, доступный ComfyUI, правка `backend/.env` | Текст и картинки через backend |

В репозиторий **не** входят: `node_modules/`, `backend/venv/` — их ставят локально один раз.

> **Важно:** сейчас фронтенд в основном работает на **mock-данных** (`src/mock.ts`). Backend уже поднимается и отдаёт API, но UI ещё не полностью подключён к нему. Для просмотра интерфейса и разработки клонирования достаточно; для end-to-end через API — нужна доработка интеграции на фронте.

## Архитектура

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Frontend   │─────▶│  Backend    │─────▶│   Ollama    │
│  React/Vite │      │  FastAPI    │      │  (LLM)      │
└─────────────┘      └──────┬──────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  ComfyUI    │
                     │ (SD / SDXL) │
                     └─────────────┘
```

## Структура проекта

```
neironovel/
├── src/                   # React (корень = frontend)
├── package.json
├── vite.config.js         # dev-сервер: порт 3000
├── backend/
│   ├── main.py
│   ├── .env               # конфиг (в репозитории; COMFYUI_URL правь под себя)
│   ├── requirements.txt
│   ├── data/              # SQLite (создаётся при первом запуске)
│   ├── gallery/
│   └── avatars/
├── install-backend.bat    # Windows: venv + pip
├── start.bat              # Windows: backend + frontend
├── check-status.bat
├── start.sh               # Linux/macOS
└── DEPLOY.md              # деплой на сервер
```

## Требования

- **Python** 3.10+ (проверено на 3.12)
- **Node.js** 18+ и npm
- **Ollama** — для генерации текста ([ollama.com](https://ollama.com))
- **ComfyUI** — для генерации изображений (отдельная установка, часто на машине с GPU)

## Локальный запуск (Windows)

### 1. Клонирование

```cmd
git clone <url-репозитория> neironovel
cd neironovel
```

### 2. Установка (один раз)

**Backend** — двойной клик по `install-backend.bat` или:

```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
mkdir data gallery avatars
cd ..
```

**Frontend** — в корне репозитория:

```cmd
npm install
```

### 3. Настройка `backend/.env`

После клона открой `backend/.env` и укажи **свой** адрес ComfyUI (в репозитории может быть чужой IP):

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=huihui_ai/gemma-4-abliterated:26b
COMFYUI_URL=http://127.0.0.1:1215
```

### 4. Внешние сервисы (для ИИ)

```cmd
ollama serve
ollama pull huihui_ai/gemma-4-abliterated:26b
```

ComfyUI — в своей папке, с доступом по сети, например:

```cmd
python main.py --listen 0.0.0.0 --port 1215
```

### 5. Запуск приложения

**Вариант A:** `start.bat`

**Вариант B:** два терминала:

```cmd
:: Терминал 1 — backend
cd backend
venv\Scripts\activate
python main.py

:: Терминал 2 — frontend (из корня репозитория)
npm run dev
```

### 6. Проверка

- Frontend: **http://localhost:3000**
- Backend: **http://localhost:8000**
- Swagger: **http://localhost:8000/docs**
- Статус сервисов: `check-status.bat`

## Локальный запуск (Linux / macOS)

```bash
git clone <url-репозитория> neironovel
cd neironovel

# Backend
cd backend
bash setup.sh
# отредактируй .env
source venv/bin/activate
python main.py &
cd ..

# Frontend
npm install
npm run dev
```

Или из корня: `chmod +x start.sh && ./start.sh` (после `setup.sh` и `npm install`).

## Сборка frontend для production

```bash
npm run build
```

Артефакт: папка `dist/`. Раздача и связка с API — в [DEPLOY.md](DEPLOY.md).

## Документация

- [backend/README.md](backend/README.md) — API и backend
- [DEPLOY.md](DEPLOY.md) — деплой на сервер (nginx, systemd, SSL)
- Swagger (локально): http://localhost:8000/docs

## Troubleshooting

### Backend падает при старте на Windows

Обнови код из репозитория: в `main.py` настроен вывод UTF-8 для консоли. Либо запускай с `set PYTHONUTF8=1`.

### Ollama не отвечает

```bash
ollama serve
curl http://localhost:11434/api/tags
```

### ComfyUI не отвечает

Проверь `COMFYUI_URL` в `backend/.env` и что ComfyUI слушает `--listen 0.0.0.0`.

### `/health` долго висит

Эндпоинт опрашивает Ollama и ComfyUI. Если они выключены, ответ может задерживаться — для проверки API используй `/docs`.

### Картинки серые (ComfyUI)

В workflow проверь VAE в узле «32»: ссылка `["18", 2]`.

## Лицензия

MIT
