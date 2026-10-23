# 🎭 RP Novel Engine

Интерактивный движок для создания визуальных новелл с ИИ-генерацией текста и изображений.

## 🏗️ Архитектура

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Frontend   │─────▶│  Backend    │─────▶│   Ollama    │
│  (React)    │      │  (FastAPI)  │      │  (Gemma 4)  │
└─────────────┘      └──────┬──────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  ComfyUI    │
                     │ (Stable     │
                     │  Diffusion) │
                     └─────────────┘
```

## 📁 Структура проекта

```
rp-novel-engine/
├── frontend/              # React приложение
│   ├── src/
│   │   ├── components/    # UI компоненты
│   │   ├── store.tsx      # Состояние приложения
│   │   └── types.ts       # TypeScript типы
│   └── package.json
│
├── backend/               # Python API
│   ├── main.py            # FastAPI endpoints
│   ├── database.py        # SQLAlchemy модели
│   ├── ollama_client.py   # Ollama интеграция
│   ├── comfyui_client.py  # ComfyUI интеграция
│   ├── workflow.json      # ComfyUI workflow
│   └── requirements.txt
│
└── start.sh               # Запуск всех сервисов
```

## 🚀 Быстрый старт (Windows)

### 1. Установка (один раз)

**Двойной клик по `install-backend.bat`**

Или вручную:
```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Настройка

Отредактируй `backend/.env`:
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=huihui_ai/gemma-4-abliterated:26b
COMFYUI_URL=http://192.168.1.107:1215
```

### 3. Запуск

**Двойной клик по `start.bat`**

Или вручную:
```cmd
:: Terminal 1 - Backend
cd backend
venv\Scripts\activate
python main.py

:: Terminal 2 - Frontend
cd frontend
npm run dev
```

### 4. Проверка статуса

**Двойной клик по `check-status.bat`**

Покажет что работает, а что нет.

### 5. Открыть

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 🎨 Возможности

### Режим чата
- Мульти-персонажные диалоги
- Разные шрифты для каждого персонажа
- Генерация изображений для каждой сцены
- Перегенерация текста и картинок
- Выбор между вариантами

### Режим визуальной новеллы
- Полноэкранный режим
- Фоновые изображения сцен
- Typewriter эффект для текста
- Навигация стрелками и пробелом
- Горячие клавиши

### Генерация
- Текст: Ollama + Gemma 4 26B
- Изображения: ComfyUI + SDXL
- Апскейл: RealESRGAN x2 (2560x1440)
- Стиль: настраиваемые пресеты

## 🔧 Технологии

### Frontend
- React 18 + TypeScript
- Tailwind CSS
- Vite
- Lucide Icons

### Backend
- Python 3.10+
- FastAPI
- SQLAlchemy + SQLite
- httpx (async HTTP)
- Pydantic

### AI
- Ollama (локальный LLM)
- ComfyUI (Stable Diffusion)
- SDXL модели
- RealESRGAN (апскейл)

## 📖 Документация

- [Backend README](backend/README.md) — установка и API
- [API Docs](http://localhost:8000/docs) — Swagger UI

## 🐛 Troubleshooting

### Ollama не отвечает
```bash
ollama serve
curl http://localhost:11434/api/tags
```

### ComfyUI не отвечает
```bash
# Запусти с --listen
cd ComfyUI
python main.py --listen 0.0.0.0 --port 1215
```

### Картинки серые
- Проверь что VAE в узле "32" ссылается на `["18", 2]`
- Это критично для корректной генерации

### Медленная генерация
- Уменьши разрешение до 1024x576
- Убери апскейл или используй x1.5
- Уменьши steps до 25-30

## 📝 Лицензия

MIT
# neironovel
# neironovel
# neironovel
