#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "🎭 RP Novel Engine — Запуск всех сервисов"
echo "==========================================="

# Проверка Ollama
echo "🦙 Проверка Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "   ✅ Ollama работает"
else
    echo "   ⚠️  Ollama не отвечает. Запусти: ollama serve"
fi

# Проверка ComfyUI (URL по умолчанию из .env — при необходимости измени)
COMFYUI_URL="${COMFYUI_URL:-http://192.168.1.107:1215}"
echo "🎨 Проверка ComfyUI ($COMFYUI_URL)..."
if curl -s "$COMFYUI_URL/system_stats" > /dev/null 2>&1; then
    echo "   ✅ ComfyUI работает"
else
    echo "   ⚠️  ComfyUI не отвечает. Проверь COMFYUI_URL в backend/.env"
fi

# Запуск Backend
echo "🐍 Запуск Backend..."
cd "$ROOT/backend"
if [ ! -d "venv" ]; then
    echo "   ⚠️  venv не найден. Запусти: bash setup.sh"
    exit 1
fi
# shellcheck source=/dev/null
source venv/bin/activate
python main.py &
BACKEND_PID=$!
cd "$ROOT"

# Запуск Frontend
echo "🎭 Запуск Frontend..."
if [ ! -d "node_modules" ]; then
    echo "   ⚠️  node_modules не найден. Запусти: npm install"
    exit 1
fi
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Все сервисы запущены!"
echo ""
echo "📍 Адреса:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo "   Ollama:   http://localhost:11434"
echo ""
echo "Нажми Ctrl+C для остановки backend и frontend"

trap "echo ''; echo '🛑 Останавливаю...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
