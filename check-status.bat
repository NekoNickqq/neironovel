@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "CYAN=[96m"
set "RESET=[0m"

cd /d "%~dp0"

echo.
echo %CYAN%🔍 Проверка статуса сервисов%RESET%
echo %CYAN%==============================%RESET%
echo.

:: Ollama
set OLLAMA_OK=0
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Ollama:    НЕ ДОСТУПЕН (localhost:11434)%RESET%
) else (
    echo %GREEN%✅ Ollama:    РАБОТАЕТ (localhost:11434)%RESET%
    set OLLAMA_OK=1
)

:: ComfyUI (адрес из backend\.env — по умолчанию см. README)
set COMFYUI_OK=0
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://192.168.1.107:1215/system_stats' -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ ComfyUI:   НЕ ДОСТУПЕН (см. COMFYUI_URL в backend\.env)%RESET%
) else (
    echo %GREEN%✅ ComfyUI:   РАБОТАЕТ%RESET%
    set COMFYUI_OK=1
)

:: Backend
set BACKEND_OK=0
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8000/docs' -TimeoutSec 5 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Backend:   НЕ ЗАПУЩЕН (localhost:8000)%RESET%
) else (
    echo %GREEN%✅ Backend:   РАБОТАЕТ (localhost:8000)%RESET%
    set BACKEND_OK=1
)

:: Frontend
set FRONTEND_OK=0
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Frontend:  НЕ ЗАПУЩЕН (localhost:3000)%RESET%
) else (
    echo %GREEN%✅ Frontend:  РАБОТАЕТ (localhost:3000)%RESET%
    set FRONTEND_OK=1
)

echo.
echo %CYAN%==============================%RESET%

if %OLLAMA_OK%==0 (
    echo.
    echo %YELLOW%💡 Чтобы запустить Ollama:%RESET%
    echo %YELLOW%   1. Открой новый терминал%RESET%
    echo %YELLOW%   2. Выполни: ollama serve%RESET%
    echo %YELLOW%   3. Скачай модель: ollama pull huihui_ai/gemma-4-abliterated:26b%RESET%
)

if %COMFYUI_OK%==0 (
    echo.
    echo %YELLOW%💡 ComfyUI:%RESET%
    echo %YELLOW%   Укажи свой URL в backend\.env (COMFYUI_URL) и запусти ComfyUI с --listen%RESET%
)

if %BACKEND_OK%==0 (
    echo.
    echo %YELLOW%💡 Чтобы запустить Backend:%RESET%
    echo %YELLOW%   1. cd backend%RESET%
    echo %YELLOW%   2. venv\Scripts\activate%RESET%
    echo %YELLOW%   3. python main.py%RESET%
)

if %FRONTEND_OK%==0 (
    echo.
    echo %YELLOW%💡 Чтобы запустить Frontend:%RESET%
    echo %YELLOW%   1. cd frontend ^& npm install ^& npm run dev%RESET%
)

echo.
pause
