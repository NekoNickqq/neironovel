@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: Цвета для вывода
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "CYAN=[96m"
set "RESET=[0m"

:: Заголовок
echo.
echo %CYAN%========================================%RESET%
echo %CYAN%  🎭 RP Novel Engine — Запуск...%RESET%
echo %CYAN%========================================%RESET%
echo.

:: ========== ПРОВЕРКА PYTHON ==========
echo %BLUE%[1/6] Проверка Python...%RESET%
python --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Python не найден!%RESET%
    echo %YELLOW%   Установи Python 3.10+ с https://python.org%RESET%
    echo %YELLOW%   При установке отметь "Add Python to PATH"%RESET%
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo %GREEN%✅ %PYTHON_VERSION%%RESET%
echo.

:: ========== ПРОВЕРКА NODE.JS ==========
echo %BLUE%[2/6] Проверка Node.js...%RESET%
node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Node.js не найден!%RESET%
    echo %YELLOW%   Установи Node.js 18+ с https://nodejs.org%RESET%
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo %GREEN%✅ Node.js %NODE_VERSION%%RESET%
echo.

:: ========== ПРОВЕРКА BACKEND VENV ==========
echo %BLUE%[3/6] Проверка Backend venv...%RESET%
if not exist "backend\venv" (
    echo %YELLOW%⚠️  venv не найден. Создаю...%RESET%
    cd backend
    python -m venv venv
    if errorlevel 1 (
        echo %RED%❌ Не удалось создать venv!%RESET%
        cd ..
        pause
        exit /b 1
    )
    echo %GREEN%✅ venv создан%RESET%
    cd ..
) else (
    echo %GREEN%✅ venv существует%RESET%
)
echo.

:: ========== ПРОВЕРКА BACKEND ЗАВИСИМОСТЕЙ ==========
echo %BLUE%[4/6] Проверка Backend зависимостей...%RESET%
cd backend
call venv\Scripts\activate.bat
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%⚠️  Зависимости не установлены. Устанавливаю...%RESET%
    pip install -r requirements.txt
    if errorlevel 1 (
        echo %RED%❌ Не удалось установить зависимости!%RESET%
        cd ..
        pause
        exit /b 1
    )
    echo %GREEN%✅ Зависимости установлены%RESET%
) else (
    echo %GREEN%✅ Зависимости установлены%RESET%
)
cd ..
echo.

:: ========== ПРОВЕРКА FRONTEND ЗАВИСИМОСТЕЙ ==========
echo %BLUE%[5/6] Проверка Frontend зависимостей...%RESET%
if not exist "frontend\node_modules" (
    echo %YELLOW%⚠️  node_modules не найден. Устанавливаю...%RESET%
    cd frontend
    call npm install
    if errorlevel 1 (
        echo %RED%❌ Не удалось установить зависимости!%RESET%
        cd ..
        pause
        exit /b 1
    )
    echo %GREEN%✅ Зависимости установлены%RESET%
    cd ..
) else (
    echo %GREEN%✅ node_modules существует%RESET%
)
echo.

:: ========== ПРОВЕРКА OLLAMA ==========
echo %BLUE%[6/6] Проверка внешних сервисов...%RESET%
echo.

set OLLAMA_OK=0
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Ollama не отвечает%RESET%
    echo %YELLOW%   Запусти в отдельном терминале: ollama serve%RESET%
    echo %YELLOW%   Или проверь что модель скачана: ollama pull huihui_ai/gemma-4-abliterated:26b%RESET%
    set OLLAMA_OK=0
) else (
    echo %GREEN%✅ Ollama работает%RESET%
    set OLLAMA_OK=1
)

set COMFYUI_OK=0
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://192.168.1.107:1215/system_stats' -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ ComfyUI не отвечает%RESET%
    echo %YELLOW%   Запусти ComfyUI с параметром: --listen 0.0.0.0 --port 1215%RESET%
    set COMFYUI_OK=0
) else (
    echo %GREEN%✅ ComfyUI работает%RESET%
    set COMFYUI_OK=1
)
echo.

:: ========== ИТОГОВЫЙ СТАТУС ==========
echo %CYAN%========================================%RESET%
echo %CYAN%  📊 Статус сервисов%RESET%
echo %CYAN%========================================%RESET%
echo.

if %OLLAMA_OK%==1 (
    echo %GREEN%✅ Ollama:    http://localhost:11434%RESET%
) else (
    echo %RED%❌ Ollama:    НЕ ДОСТУПЕН%RESET%
)

if %COMFYUI_OK%==1 (
    echo %GREEN%✅ ComfyUI:   http://192.168.1.107:1215%RESET%
) else (
    echo %RED%❌ ComfyUI:   НЕ ДОСТУПЕН%RESET%
)

echo %GREEN%✅ Backend:   http://localhost:8000%RESET%
echo %GREEN%✅ Frontend:  http://localhost:5173%RESET%
echo.

if %OLLAMA_OK%==0 (
    echo %YELLOW%⚠️  Ollama не запущен. Backend будет работать, но без генерации текста.%RESET%
)
if %COMFYUI_OK%==0 (
    echo %YELLOW%⚠️  ComfyUI не запущен. Backend будет работать, но без генерации картинок.%RESET%
)
echo.

:: ========== ЗАПУСК BACKEND ==========
echo %BLUE%🚀 Запуск Backend...%RESET%
cd backend
start "RP Novel Engine - Backend" cmd /k "call venv\Scripts\activate.bat && python main.py"
cd ..
timeout /t 3 /nobreak >nul

:: ========== ЗАПУСК FRONTEND ==========
echo %BLUE%🚀 Запуск Frontend...%RESET%
cd frontend
start "RP Novel Engine - Frontend" cmd /k "npm run dev"
cd ..
timeout /t 2 /nobreak >nul

:: ========== ОТКРЫТИЕ БРАУЗЕРА ==========
echo.
echo %GREEN%✅ Все сервисы запущены!%RESET%
echo.
echo %CYAN%📍 Адреса:%RESET%
echo %CYAN%   Frontend:  http://localhost:5173%RESET%
echo %CYAN%   Backend:   http://localhost:8000%RESET%
echo %CYAN%   API Docs:  http://localhost:8000/docs%RESET%
echo.
echo %BLUE%🌐 Открываю браузер...%RESET%
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo %GREEN%✅ Готово! Можешь закрыть это окно.%RESET%
echo %YELLOW%   (Backend и Frontend работают в отдельных окнах)%RESET%
echo.
pause
