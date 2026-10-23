@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   RP Novel Engine — запуск
echo ========================================
echo.

cd /d "%~dp0"

echo [1/6] Проверка Python...
set PYTHON_CMD=
where python >nul 2>&1 && set PYTHON_CMD=python && goto :py_ok
where python3 >nul 2>&1 && set PYTHON_CMD=python3 && goto :py_ok
where py >nul 2>&1 && set PYTHON_CMD=py && goto :py_ok
echo ОШИБКА: Python не найден. Установи с https://python.org
pause
exit /b 1

:py_ok
for /f "tokens=*" %%i in ('!PYTHON_CMD! --version 2^>^&1') do set PYTHON_VERSION=%%i
echo OK: !PYTHON_VERSION!
echo.

echo [2/6] Проверка Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Node.js не найден. Установи с https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo OK: Node.js !NODE_VERSION!
echo.

echo [3/6] Проверка Backend venv...
if not exist "backend\venv\Scripts\python.exe" (
    echo ОШИБКА: venv не найден. Запусти install-backend.bat
    pause
    exit /b 1
)
echo OK: venv есть
echo.

echo [4/6] Проверка зависимостей backend...
cd backend
call venv\Scripts\activate.bat
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: зависимости не установлены. Запусти install-backend.bat
    cd ..
    pause
    exit /b 1
)
echo OK: зависимости установлены
cd ..
echo.

echo [5/6] Проверка Frontend...
if not exist "frontend\node_modules" (
    echo frontend\node_modules не найден. Запускаю npm install...
    cd frontend
    call npm install
    cd ..
    if errorlevel 1 (
        echo ОШИБКА: npm install не удался
        pause
        exit /b 1
    )
    echo OK: npm install завершён
) else (
    echo OK: frontend\node_modules есть
)
echo.

echo [6/6] Проверка Ollama и ComfyUI...
echo.

set OLLAMA_OK=0
powershell -Command "try { $null = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -TimeoutSec 3 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [--] Ollama не отвечает: localhost:11434
    echo      Запусти: ollama serve
) else (
    echo [OK] Ollama работает
    set OLLAMA_OK=1
)

set COMFYUI_OK=0
powershell -Command "try { $null = Invoke-WebRequest -Uri 'http://192.168.1.107:1215/system_stats' -TimeoutSec 3 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [--] ComfyUI не отвечает. Проверь COMFYUI_URL в backend\.env
) else (
    echo [OK] ComfyUI работает
    set COMFYUI_OK=1
)
echo.

echo ========================================
echo   Итог
echo ========================================
echo Backend:   http://localhost:8000
echo Frontend:  http://localhost:3000
echo API Docs:  http://localhost:8000/docs
echo.

if !OLLAMA_OK!==0 echo Внимание: без Ollama текст не генерируется.
if !COMFYUI_OK!==0 echo Внимание: без ComfyUI картинки не генерируются.
echo.

echo Запуск Backend и Frontend в отдельных окнах...
start "RP Novel Backend" cmd /k call "%~dp0launch-backend.bat"
timeout /t 2 /nobreak >nul
start "RP Novel Frontend" cmd /k call "%~dp0launch-frontend.bat"
timeout /t 2 /nobreak >nul

echo.
echo Готово. Открываю браузер...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo Можно закрыть это окно. Backend и Frontend — в двух других окнах.
echo.
pause
