@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "CYAN=[96m"
set "BLUE=[94m"
set "RESET=[0m"

echo.
echo %CYAN%========================================%RESET%
echo %CYAN%  📦 Установка Backend зависимостей%RESET%
echo %CYAN%========================================%RESET%
echo.

:: ========== ПРОВЕРКА PYTHON ==========
echo %BLUE%[1/4] Проверка Python...%RESET%

:: Пробуем разные команды для поиска Python
set PYTHON_CMD=
where python >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
    goto :python_found
)
where python3 >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python3
    goto :python_found
)
where py >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py
    goto :python_found
)

echo %RED%❌ Python не найден!%RESET%
echo %YELLOW%   Установи Python с https://python.org/downloads/%RESET%
echo %YELLOW%   ВАЖНО: при установке отметь "Add Python to PATH"%RESET%
echo.
pause
exit /b 1

:python_found
for /f "tokens=*" %%i in ('%PYTHON_CMD% --version 2^>^&1') do set PYTHON_VERSION=%%i
echo %GREEN%✅ %PYTHON_VERSION%%RESET%
echo.

:: ========== ПЕРЕХОД В ПАПКУ BACKEND ==========
cd /d "%~dp0backend"
echo %BLUE%📁 Рабочая папка: %CD%%RESET%
echo.

:: ========== СОЗДАНИЕ VENV ==========
echo %BLUE%[2/4] Создание виртуального окружения...%RESET%
if exist "venv" (
    echo %YELLOW%⚠️  venv уже существует. Удаляю старый...%RESET%
    rmdir /s /q venv
)
%PYTHON_CMD% -m venv venv
if errorlevel 1 (
    echo %RED%❌ Не удалось создать venv!%RESET%
    echo %YELLOW%   Попробуй вручную: %PYTHON_CMD% -m venv venv%RESET%
    pause
    exit /b 1
)
echo %GREEN%✅ venv создан%RESET%
echo.

:: ========== АКТИВАЦИЯ И УСТАНОВКА ==========
echo %BLUE%[3/4] Установка зависимостей...%RESET%
call venv\Scripts\activate.bat

:: Сначала обновим pip
echo %BLUE%   Обновляю pip...%RESET%
python -m pip install --upgrade pip >nul 2>&1

:: Устанавливаем зависимости
echo %BLUE%   Устанавливаю пакеты (это может занять 1-2 минуты)...%RESET%
echo.
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo %RED%❌ Ошибка установки!%RESET%
    echo.
    echo %YELLOW%💡 Возможные решения:%RESET%
    echo %YELLOW%   1. Проверь интернет-соединение%RESET%
    echo %YELLOW%   2. Попробуй: pip install --upgrade pip%RESET%
    echo %YELLOW%   3. Попробуй вручную: pip install fastapi uvicorn sqlalchemy%RESET%
    echo.
    pause
    exit /b 1
)

echo.
echo %GREEN%✅ Все зависимости установлены!%RESET%
echo.

:: ========== СОЗДАНИЕ ПАПOK ==========
echo %BLUE%[4/4] Создание папок...%RESET%
if not exist "data" mkdir data
if not exist "gallery" mkdir gallery
if not exist "avatars" mkdir avatars
echo %GREEN%✅ Папки созданы (data/, gallery/, avatars/)%RESET%
echo.

:: ========== ПРОВЕРКА УСТАНОВКИ ==========
echo %BLUE%🔍 Проверяю установку...%RESET%
python -c "import fastapi; import uvicorn; import sqlalchemy; import httpx; print('OK')" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Что-то не установилось!%RESET%
    pause
    exit /b 1
)
echo %GREEN%✅ Все пакеты работают!%RESET%
echo.

:: ========== ИТОГ ==========
echo %CYAN%========================================%RESET%
echo %GREEN%✅ Установка завершена успешно!%RESET%
echo %CYAN%========================================%RESET%
echo.
echo %CYAN%Что дальше:%RESET%
echo   1. Настрой %YELLOW%backend\.env%RESET% (адреса Ollama и ComfyUI)
echo   2. Запусти %YELLOW%start.bat%RESET% в главной папке
echo.
echo %CYAN%Или запусти backend вручную:%RESET%
echo   cd backend
echo   venv\Scripts\activate
echo   python main.py
echo.
pause
