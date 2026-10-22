@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "CYAN=[96m"
set "RESET=[0m"

echo.
echo %CYAN%📦 Установка Backend зависимостей%RESET%
echo %CYAN%==================================%RESET%
echo.

:: Проверка Python
python --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Python не найден!%RESET%
    echo %YELLOW%   Установи Python 3.10+ с https://python.org%RESET%
    pause
    exit /b 1
)

cd backend

:: Создание venv если нет
if not exist "venv" (
    echo %BLUE%📁 Создаю виртуальное окружение...%RESET%
    python -m venv venv
    if errorlevel 1 (
        echo %RED%❌ Не удалось создать venv!%RESET%
        cd ..
        pause
        exit /b 1
    )
    echo %GREEN%✅ venv создан%RESET%
    echo.
)

:: Активация и установка
echo %BLUE%📥 Устанавливаю зависимости...%RESET%
call venv\Scripts\activate.bat
pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo %RED%❌ Ошибка установки зависимостей!%RESET%
    echo %YELLOW%   Попробуй вручную:%RESET%
    echo %YELLOW%   cd backend%RESET%
    echo %YELLOW%   venv\Scripts\activate%RESET%
    echo %YELLOW%   pip install -r requirements.txt%RESET%
    cd ..
    pause
    exit /b 1
)

:: Создание папок
if not exist "data" mkdir data
if not exist "gallery" mkdir gallery
if not exist "avatars" mkdir avatars

cd ..

echo.
echo %GREEN%✅ Установка завершена!%RESET%
echo.
echo %CYAN%Теперь запусти:%RESET%
echo %CYAN%   start.bat — для запуска всех сервисов%RESET%
echo %CYAN%   или%RESET%
echo %CYAN%   check-status.bat — для проверки статуса%RESET%
echo.
pause
