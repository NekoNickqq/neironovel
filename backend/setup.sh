#!/bin/bash

echo "🐍 RP Novel Engine — Backend Setup"
echo "===================================="

# Проверка Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 не найден! Установи Python 3.10+"
    exit 1
fi

echo "✅ Python: $(python3 --version)"

# Создание venv
if [ ! -d "venv" ]; then
    echo "📦 Создаю виртуальное окружение..."
    python3 -m venv venv
fi

# Активация
echo "🔧 Активирую venv..."
source venv/bin/activate

# Установка зависимостей
echo "📥 Устанавливаю зависимости..."
pip install --upgrade pip
pip install -r requirements.txt

# Создание папок
echo "📁 Создаю папки..."
mkdir -p data gallery avatars

echo ""
echo "✅ Установка завершена!"
echo ""
echo "Для запуска бэкенда:"
echo "  source venv/bin/activate"
echo "  python main.py"
echo ""
echo "Или используй start.sh"
