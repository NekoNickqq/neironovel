# 🐍 RP Novel Engine — Backend

Python бэкенд для RP Novel Engine с интеграцией Ollama и ComfyUI.

## 📁 Структура

```
backend/
├── main.py              # FastAPI приложение, эндпоинты
├── database.py          # SQLAlchemy модели (SQLite)
├── config.py            # Загрузка конфигурации из .env
├── ollama_client.py     # Клиент для Ollama API
├── comfyui_client.py    # Клиент для ComfyUI API
├── utils.py             # Утилиты (парсинг JSON, очистка ключей, промпты)
├── workflow.json        # Улучшенный workflow для ComfyUI
├── requirements.txt     # Python зависимости
├── .env                 # Конфигурация (URL, пути)
├── gallery/             # Сгенерированные изображения
├── avatars/             # Аватарки персонажей
└── data/                # SQLite база данных
```

## 🚀 Установка и запуск

### 1. Создай виртуальное окружение

```bash
cd backend

# Создать venv
python -m venv venv

# Активировать
# Linux / macOS:
source venv/bin/activate
# Windows (CMD):
venv\Scripts\activate.bat
# Windows (PowerShell):
venv\Scripts\Activate.ps1
```

### 2. Установи зависимости

```bash
pip install -r requirements.txt
```

### 3. Настрой .env

Отредактируй `.env` под свои настройки:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=huihui_ai/gemma-4-abliterated:26b
COMFYUI_URL=http://192.168.1.107:1215
```

### 4. Запусти сервер

```bash
python main.py
# или
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Сервер будет доступен на `http://localhost:8000`

### 5. Проверь здоровье

```bash
curl http://localhost:8000/health
```

Должно вернуть:
```json
{
  "status": "ok",
  "services": {
    "ollama": true,
    "comfyui": true
  }
}
```

## 🔧 API Endpoints

### Основные

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Проверка здоровья сервисов |
| GET | `/dialogues` | Список диалогов |
| POST | `/dialogues` | Создать диалог |
| GET | `/dialogues/{id}` | Получить диалог с сообщениями |
| DELETE | `/dialogues/{id}` | Удалить диалог |
| POST | `/message` | Отправить сообщение (Full Turn) |
| POST | `/regenerate/text` | Перегенерировать текст |
| POST | `/regenerate/image` | Перегенерировать картинку |

### Примеры

**Создать диалог:**
```bash
curl -X POST http://localhost:8000/dialogues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Тестовый диалог",
    "world_lore": "Средневековое фэнтези",
    "style_preset": "dark fantasy, cinematic"
  }'
```

**Отправить сообщение:**
```bash
curl -X POST http://localhost:8000/message \
  -H "Content-Type: application/json" \
  -d '{
    "dialogue_id": "uuid-тут",
    "user_text": "Осмотреться вокруг",
    "generate_image": true
  }'
```

## 🎨 Улучшения workflow.json

### Что было изменено:

| Параметр | Было | Стало | Почему |
|----------|------|-------|--------|
| **Негативный промпт** | Пустой `""` | Полный набор тегов | Улучшает качество, убирает артефакты |
| **KSampler** | `KSamplerAdvanced` с `end_at_step: 10000` | Обычный `KSampler` | Проще, надёжнее, нет путаницы со шагами |
| **Scheduler** | `"simple"` | `"karras"` | Лучше для SDXL, более плавные переходы |
| **CFG** | `3` | `6` | Баланс между креативностью и стабильностью |
| **Steps** | `40` | `35` | Чуть быстрее, качество почти то же |
| **Seed** | Фиксированный | Рандомизируется | Каждый раз уникальная картинка |
| **Узел** | `"37"` | `"99"` | Переименован для ясности |

### Негативный промпт (узел "20"):
```
ugly, blurry, low quality, deformed, bad anatomy, bad hands, extra fingers, 
mutated, disfigured, worst quality, low resolution, badly drawn, watermark, 
text, signature, cropped, jpeg artifacts, sketch
```

### Почему KSampler вместо KSamplerAdvanced:
- `KSamplerAdvanced` нужен для img2img и inpainting (где `start_at_step` и `end_at_step` важны)
- Для txt2img обычный `KSampler` проще и надёжнее
- Меньше параметров — меньше шансов ошибиться

### Почему scheduler "karras":
- `simple` — базовый, но менее стабилен
- `karras` — оптимизирован для SDXL, даёт более чистые результаты
- `normal` — тоже хороший вариант, но `karras` быстрее сходится

### Почему CFG 6 вместо 3:
- CFG 3 — слишком низкий, картинки могут быть "размытыми" по смыслу
- CFG 6-7 — золотая середина для SDXL
- CFG 10+ — перенасыщенные, неестественные цвета

## 🔗 Интеграция с фронтендом

Фронтенд должен обращаться к бэкенду по этим адресам:

```typescript
// Вместо моковых функций в store.tsx:

const API_BASE = 'http://localhost:8000';

// Создать диалог
const response = await fetch(`${API_BASE}/dialogues`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title, world_lore, ... })
});

// Отправить сообщение
const response = await fetch(`${API_BASE}/message`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dialogue_id, user_text, generate_image: true })
});

// Перегенерировать текст
const response = await fetch(`${API_BASE}/regenerate/text`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dialogue_id, message_id })
});
```

## 🐛 Частые проблемы

### Ollama не отвечает
```bash
# Проверь что Ollama запущен
ollama serve

# Проверь доступность
curl http://localhost:11434/api/tags
```

### ComfyUI не отвечает
```bash
# Проверь что ComfyUI запущен с --listen
# В папке ComfyUI:
python main.py --listen 0.0.0.0 --port 1215

# Проверь доступность
curl http://192.168.1.107:1215/system_stats
```

### Картинка серая/битая
- Проверь что в узле "32" (VAEDecode) VAE ссылается на `["18", 2]`
- Это критично — без правильного VAE картинки будут серыми

### JSON не парсится
- Ollama иногда добавляет markdown обёртки
- `utils.py` содержит `extract_json_from_text()` который это чинит
- Если всё равно не работает — проверь что модель поддерживает JSON format

## 📊 Производительность

| Операция | Время | Примечание |
|----------|-------|------------|
| Генерация текста (Ollama) | 10-30 сек | Зависит от модели и GPU |
| Генерация картинки (ComfyUI) | 30-90 сек | 1280x720 → 2560x1440 |
| Апскейл x2 | +10-20 сек | RealESRGAN медленный |

**Совет:** Если генерация слишком медленная:
1. Уменьши разрешение до 1024x576
2. Убери апскейл или используй x1.5
3. Уменьши steps до 25-30
4. Используй более быструю модель (SDXL Turbo)

## 🔒 Безопасность

⚠️ **Важно:** Этот бэкенд не имеет аутентификации!

Для продакшена нужно добавить:
- JWT токены
- Rate limiting
- Валидацию входных данных
- HTTPS

Для локальной разработки — ок.

## 📝 Лицензия

MIT
