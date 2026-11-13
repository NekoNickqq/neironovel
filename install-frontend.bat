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
rem Восстановление повреждённой установки (например, пустой node_modules\.bin)
if not exist "node_modules\vite\bin\vite.js" (
    echo Установка повреждена: vite не найден. Переустанавливаю зависимости...
    rmdir /s /q node_modules 2>nul
    del /q package-lock.json 2>nul
    call npm install
    if errorlevel 1 (
        echo ОШИБКА: npm install не удался
        pause
        exit /b 1
    )
)
echo Готово.
pause
