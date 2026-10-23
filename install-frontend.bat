@echo off
chcp 65001 >nul
cd /d "%~dp0frontend"
echo Установка зависимостей Frontend...
where node >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Node.js не найден
    pause
    exit /b 1
)
call npm install
if errorlevel 1 (
    echo ОШИБКА: npm install
    pause
    exit /b 1
)
echo Готово.
pause
