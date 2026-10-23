@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "CYAN=[96m"
set "RESET=[0m"

echo.
echo %CYAN%========================================%RESET%
echo %CYAN%  🎭 RP Novel Engine — Запуск...%RESET%
echo %CYAN%========================================%RESET%
echo.

:: Переходим в папку скрипта
cd /d "%~dp0"

:: ========== ПРОВЕРКА PYTHON ==========
echo %BLUE%[1/6] Проверка Python...%RESET%
set PYTHON_CMD=
where python >nul 2>&1 && set PYTHON_CMD=python && goto :py_ok
where python3 >nul 2>&1 && set PYTHON_CMD=python3 && goto :py_ok
where py >nul 2>&1 && set PYTHON_CMD=py && goto :py_ok

echo %RED%❌ Python не найден!%RESET%
echo %YELLOW%   Установи Python с https://python.org%RESET%
pause
exit /b 1

:py_ok
for /f "tokens=*" %%i in ('%PYTHON_CMD% --version 2^>^&1') do set PYTHON_VERSION=%%i
echo %GREEN%✅ %PYTHON_VERSION%%RESET%
echo.

:: ========== ПРОВЕРКА NODE.JS ==========
echo %BLUE%[2/6] Проверка Node.js...%RESET%
where node >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Node.js не найден!%RESET%
    echo %YELLOW%   Установи с https://nodejs.org%RESET%
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo %GREEN%✅ Node.js %NODE_VERSION%%RESET%
echo.

:: ========== ПРОВЕРКА BACKEND VENV ==========
echo %BLUE%[3/6] Проверка Backend venv...%RESET%
if not exist "backend\venv\Scripts\python.exe" (
    echo %RED%❌ venv не найден!%RESET%
    echo %YELLOW%   Запусти сначала: install-backend.bat%RESET%
    pause
    exit /b 1
)
echo %GREEN%✅ venv существует%RESET%
echo.

:: ========== ПРОВЕРКА BACKEND ЗАВИСИМОСТЕЙ ==========
echo %BLUE%[4/6] Проверка Backend зависимостей...%RESET%
cd backend
call venv\Scripts\activate.bat
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Зависимости не установлены!%RESET%
    echo %YELLOW%   Запусти: install-backend.bat%RESET%
    cd ..
    pause
    exit /b 1
)
echo %GREEN%✅ Зависимости установлены%RESET%
cd ..
echo.

:: ========== ПРОВЕРКА FRONTEND ==========
echo %BLUE%[5/6] Проверка Frontend...%RESET%
if not exist "node_modules" (
    echo %YELLOW%⚠️  node_modules не найден. Устанавливаю...%RESET%
    call npm install
    if errorlevel 1 (
        echo %RED%❌ Не удалось установить!%RESET%
        cd ..
        pause
        exit /b 1
    )
    echo %GREEN%✅ Установлено%RESET%
) else (
    echo %GREEN%✅ node_modules существует%RESET%
)
echo.

:: ========== ПРОВЕРКА ВНЕШНИХ СЕРВИСОВ ==========
echo %BLUE%[6/6] Проверка внешних сервисов...%RESET%
echo.

set OLLAMA_OK=0
powershell -Command "try { $null = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -TimeoutSec 3 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Ollama не отвечает (localhost:11434)%RESET%
    echo %YELLOW%   Запусти в отдельном терминале: ollama serve%RESET%
) else (
    echo %GREEN%✅ Ollama работает%RESET%
    set OLLAMA_OK=1
)

set COMFYUI_OK=0
powershell -Command "try { $null = Invoke-WebRequest -Uri 'http://192.168.1.107:1215/system_stats' -TimeoutSec 3 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ ComfyUI не отвечает (192.168.1.107:1215)%RESET%
    echo %YELLOW%   Запусти ComfyUI с: --listen 0.0.0.0 --port 1215%RESET%
) else (
    echo %GREEN%✅ ComfyUI работает%RESET%
    set COMFYUI_OK=1
)
echo.

:: ========== СТАТУС ==========
echo %CYAN%========================================%RESET%
echo %CYAN%  📊 Итоговый статус%RESET%
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
echo %GREEN%✅ Frontend:  http://localhost:3000%RESET%
echo.

if %OLLAMA_OK%==0 echo %YELLOW%⚠️  Без Ollama текст генерироваться не будет%RESET%
if %COMFYUI_OK%==0 echo %YELLOW%⚠️  Без ComfyUI картинки генерироваться не будут%RESET%
echo.

:: ========== ЗАПУСК BACKEND ==========
echo %BLUE%🚀 Запуск Backend...%RESET%
cd backend
start "🐍 RP Novel - Backend" cmd /k "cd /d \"%~dp0backend\" && call venv\Scripts\activate.bat && echo. && echo ✅ Backend запущен на http://localhost:8000 && echo 📖 API Docs: http://localhost:8000/docs && echo. && python main.py"
cd ..
timeout /t 3 /nobreak >nul

:: ========== ЗАПУСК FRONTEND ==========
echo %BLUE%🚀 Запуск Frontend...%RESET%
start "🎭 RP Novel - Frontend" cmd /k "cd /d \"%~dp0\" && echo. && echo ✅ Frontend запущен на http://localhost:3000 && echo. && npm run dev"
timeout /t 3 /nobreak >nul

:: ========== ОТКРЫТИЕ БРАУЗЕРА ==========
echo.
echo %GREEN%✅ Все сервисы запущены!%RESET%
echo.
echo %CYAN%📍 Адреса:%RESET%
echo %CYAN%   Frontend:  http://localhost:3000%RESET%
echo %CYAN%   Backend:   http://localhost:8000%RESET%
echo %CYAN%   API Docs:  http://localhost:8000/docs%RESET%
echo.
echo %BLUE%🌐 Открываю браузер через 3 секунды...%RESET%
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo %GREEN%✅ Готово! Можешь закрыть это окно.%RESET%
echo %YELLOW%   Backend и Frontend работают в отдельных окнах%RESET%
echo.
pause
