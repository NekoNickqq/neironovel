#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "🎭 RP Novel Engine — Запуск всех сервисов"
echo "==========================================="

echo "🦙 Проверка Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "   ✅ Ollama работает"
else
    echo "   ⚠️  Ollama не отвечает. Запусти: ollama serve"
fi

COMFYUI_URL="${COMFYUI_URL:-http://192.168.1.107:1215}"
echo "🎨 Проверка ComfyUI ($COMFYUI_URL)..."
if curl -s "$COMFYUI_URL/system_stats" > /dev/null 2>&1; then
    echo "   ✅ ComfyUI работает"
else
    echo "   ⚠️  ComfyUI не отвечает. Проверь COMFYUI_URL в backend/.env"
fi

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

echo "🎭 Запуск Frontend..."
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
    echo "   ⚠️  node_modules не найден. Запусти: npm install (v papke frontend)"
    exit 1
fi
npm run dev &
FRONTEND_PID=$!
cd "$ROOT"

echo ""
echo "✅ Все сервисы запущены!"
echo ""
echo "📍 Адреса:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Нажми Ctrl+C для остановки backend и frontend"

trap "echo ''; echo '🛑 Останавливаю...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
