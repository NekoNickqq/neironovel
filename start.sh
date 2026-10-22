#!/bin/bash

echo "🎭 RP Novel Engine — Запуск всех сервисов"
echo "==========================================="

# Проверка Ollama
echo "🦙 Проверка Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "   ✅ Ollama работает"
else
    echo "   ⚠️  Ollama не отвечает. Запусти: ollama serve"
fi

# Проверка ComfyUI
echo "🎨 Проверка ComfyUI..."
if curl -s http://192.168.1.107:1215/system_stats > /dev/null 2>&1; then
    echo "   ✅ ComfyUI работает"
else
    echo "   ⚠️  ComfyUI не отвечает. Запусти ComfyUI вручную"
fi

# Запуск Backend
echo "🐍 Запуск Backend..."
cd backend
if [ ! -d "venv" ]; then
    echo "   ⚠️  venv не найден. Запусти: bash setup.sh"
    exit 1
fi
source venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..

# Запуск Frontend
echo "🎭 Запуск Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "   ⚠️  node_modules не найден. Запусти: npm install"
    exit 1
fi
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Все сервисы запущены!"
echo ""
echo "📍 Адреса:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo "   Ollama:   http://localhost:11434"
echo "   ComfyUI:  http://192.168.1.107:1215"
echo ""
echo "Нажми Ctrl+C для остановки всех сервисов"

# Ожидание Ctrl+C
trap "echo ''; echo '🛑 Останавливаю...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
