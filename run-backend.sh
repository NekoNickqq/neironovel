#!/bin/bash

# Быстрый запуск бэкенда

cd backend

# Активация venv
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ venv не найден! Запусти: bash setup.sh"
    exit 1
fi

# Запуск
echo "🐍 Запуск Backend на http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/docs"
echo ""
python main.py
